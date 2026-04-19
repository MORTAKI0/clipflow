type CreateBufferPostArgs = {
  text: string;
  dueAt: string;
  videoUrl: string;
  thumbnailUrl: string;
  boardServiceId?: string;
  pinTitle?: string;
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
