type CreateBufferPostArgs = {
  text: string;
  dueAt: string;
  videoUrl: string;
  thumbnailUrl: string;
  boardServiceId?: string;
  pinTitle?: string;
};

export type PinterestBoard = {
  serviceId: string;
  name: string | null;
};

type GraphQLErrorItem = {
  message?: string;
  extensions?: {
    code?: string;
  };
};

type BufferPost = {
  id: string;
  text: string | null;
  dueAt: string | null;
};

type BufferSuccessResult = {
  ok: true;
  post: BufferPost;
};

type BufferFailureResult = {
  ok: false;
  kind: "config_error" | "network_error" | "graphql_error" | "mutation_error" | "invalid_response";
  message: string;
};

type BufferRequestResult = BufferSuccessResult | BufferFailureResult;

type BufferGraphQLResponse = {
  data?: {
    createPost?: {
      __typename?: string;
      message?: string;
      post?: {
        id: string;
        text?: string | null;
        dueAt?: string | null;
      };
    };
  };
  errors?: GraphQLErrorItem[];
};

type PinterestBoardsGraphQLResponse = {
  data?: {
    channel?: {
      metadata?: {
        __typename?: string;
        boards?: Array<{
          serviceId?: string | null;
          name?: string | null;
          displayName?: string | null;
        }> | null;
      } | null;
    } | null;
  };
  errors?: GraphQLErrorItem[];
};

const CREATE_POST_MUTATION = `
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      __typename
      ... on PostActionSuccess {
        post {
          id
          text
          dueAt
        }
      }
      ... on MutationError {
        message
      }
    }
  }
`;

const GET_PINTEREST_BOARDS_WITH_NAMES_QUERY = `
  query GetPinterestBoards($input: ChannelInput!) {
    channel(input: $input) {
      metadata {
        __typename
        ... on PinterestMetadata {
          boards {
            serviceId
            name
            displayName
          }
        }
      }
    }
  }
`;

const GET_PINTEREST_BOARDS_WITH_NAME_QUERY = `
  query GetPinterestBoards($input: ChannelInput!) {
    channel(input: $input) {
      metadata {
        __typename
        ... on PinterestMetadata {
          boards {
            serviceId
            name
          }
        }
      }
    }
  }
`;

const GET_PINTEREST_BOARDS_QUERY = `
  query GetPinterestBoards($input: ChannelInput!) {
    channel(input: $input) {
      metadata {
        __typename
        ... on PinterestMetadata {
          boards {
            serviceId
          }
        }
      }
    }
  }
`;

type PinterestBoardsSuccessResult = {
  ok: true;
  boards: PinterestBoard[];
};

type PinterestBoardsFailureResult = {
  ok: false;
  message: string;
};

export async function getPinterestBoards(): Promise<PinterestBoardsSuccessResult | PinterestBoardsFailureResult> {
  const apiKey = process.env.BUFFER_API_KEY;
  const channelId = process.env.BUFFER_PINTEREST_CHANNEL_ID;

  if (!apiKey || !channelId) {
    return {
      ok: false,
      message: "Buffer API configuration is missing.",
    };
  }

  try {
    const resultWithNames = await runPinterestBoardsQuery(apiKey, channelId, GET_PINTEREST_BOARDS_WITH_NAMES_QUERY);
    const invalidDisplayName = hasInvalidField(resultWithNames.errors, "displayName");
    const invalidName = hasInvalidField(resultWithNames.errors, "name");

    let result = resultWithNames;

    if (invalidDisplayName && !invalidName) {
      result = await runPinterestBoardsQuery(apiKey, channelId, GET_PINTEREST_BOARDS_WITH_NAME_QUERY);
    } else if (invalidDisplayName || invalidName) {
      // Buffer's Pinterest board schema can fall back to serviceId-only boards.
      result = await runPinterestBoardsQuery(apiKey, channelId, GET_PINTEREST_BOARDS_QUERY);
    }

    if (Array.isArray(result.errors) && result.errors.length > 0) {
      console.error("Buffer board GraphQL errors:", result.errors);

      return {
        ok: false,
        message: "Failed to load Pinterest boards.",
      };
    }

    const boards =
      result.data?.channel?.metadata?.__typename === "PinterestMetadata"
        ? result.data.channel.metadata.boards ?? []
        : [];

    return {
      ok: true,
      boards: boards
        .filter(
          (board): board is { serviceId: string; name?: string | null; displayName?: string | null } =>
            typeof board?.serviceId === "string" && board.serviceId.length > 0
        )
        .map((board) => ({
          serviceId: board.serviceId,
          name: board.displayName ?? board.name ?? null,
        })),
    };
  } catch (error) {
    console.error("Buffer board request failed:", error);

    return {
      ok: false,
      message: "Failed to load Pinterest boards.",
    };
  }
}

async function runPinterestBoardsQuery(
  apiKey: string,
  channelId: string,
  query: string
): Promise<PinterestBoardsGraphQLResponse> {
  const response = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      variables: {
        input: {
          id: channelId,
        },
      },
    }),
  });

  return (await response.json()) as PinterestBoardsGraphQLResponse;
}

function hasInvalidField(errors: GraphQLErrorItem[] | undefined, fieldName: string): boolean {
  return Array.isArray(errors)
    ? errors.some(
        (error) =>
          typeof error.message === "string" &&
          error.message.includes(`Cannot query field "${fieldName}"`)
      )
    : false;
}

export async function createBufferPost({
  text,
  dueAt,
  videoUrl,
  thumbnailUrl,
  boardServiceId,
  pinTitle,
}: CreateBufferPostArgs): Promise<BufferRequestResult> {
  const apiKey = process.env.BUFFER_API_KEY;
  const channelId = process.env.BUFFER_PINTEREST_CHANNEL_ID;

  if (!apiKey || !channelId) {
    return {
      ok: false,
      kind: "config_error",
      message: "Buffer API configuration is missing.",
    };
  }

  const input: {
    text: string;
    channelId: string;
    schedulingType: "automatic";
    mode: "customScheduled";
    dueAt: string;
    assets: {
      images: Array<{ url: string }>;
      videos: Array<{ url: string; thumbnailUrl: string }>;
    };
    metadata?: {
      pinterest: {
        boardServiceId: string;
        title?: string;
      };
    };
  } = {
    text,
    channelId,
    schedulingType: "automatic",
    mode: "customScheduled",
    dueAt,
    assets: {
      images: [{ url: thumbnailUrl }],
      videos: [{ url: videoUrl, thumbnailUrl }],
    },
  };

  if (boardServiceId) {
    input.metadata = {
      pinterest: {
        boardServiceId,
        ...(pinTitle ? { title: pinTitle } : {}),
      },
    };
  }

  let result: BufferGraphQLResponse;

  try {
    const response = await fetch("https://api.buffer.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: CREATE_POST_MUTATION,
        variables: { input },
      }),
    });

    result = (await response.json()) as BufferGraphQLResponse;
  } catch (error) {
    console.error("Buffer request failed:", error);

    return {
      ok: false,
      kind: "network_error",
      message: "Unable to reach Buffer.",
    };
  }

  if (Array.isArray(result.errors) && result.errors.length > 0) {
    console.error("Buffer GraphQL errors:", result.errors);

    const firstError = result.errors[0];
    const code = firstError.extensions?.code;
    const message = firstError.message || "Buffer returned a GraphQL error.";

    return {
      ok: false,
      kind: "graphql_error",
      message: code ? `${code}: ${message}` : message,
    };
  }

  const mutationResult = result.data?.createPost;

  if (mutationResult?.post) {
    return {
      ok: true,
      post: {
        id: mutationResult.post.id,
        text: mutationResult.post.text ?? null,
        dueAt: mutationResult.post.dueAt ?? null,
      },
    };
  }

  if (mutationResult?.message) {
    return {
      ok: false,
      kind: "mutation_error",
      message: mutationResult.message,
    };
  }

  console.error("Unexpected Buffer response:", result);

  return {
    ok: false,
    kind: "invalid_response",
    message: "Buffer returned an unexpected response.",
  };
}
