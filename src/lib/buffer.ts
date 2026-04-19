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

export type BufferPost = {
  id: string;
  text: string | null;
  dueAt: string | null;
};

type GraphQLErrorItem = {
  message?: string;
  extensions?: {
    code?: string;
  };
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

type OrganizationsGraphQLResponse = {
  data?: {
    account?: {
      organizations?: Array<{
        id?: string | null;
        limits?: {
          scheduledPosts?: number | null;
        } | null;
      }> | null;
    } | null;
  };
  errors?: GraphQLErrorItem[];
};

type ScheduledPostsGraphQLResponse = {
  data?: {
    posts?: {
      totalCount?: number | null;
      edges?: Array<{
        node?: {
          id?: string | null;
          dueAt?: string | null;
          status?: string | null;
          channelId?: string | null;
        } | null;
      }> | null;
      pageInfo?: {
        hasNextPage?: boolean | null;
        endCursor?: string | null;
      } | null;
    } | null;
  };
  errors?: GraphQLErrorItem[];
};

type ScheduledPostsConnection = NonNullable<ScheduledPostsGraphQLResponse["data"]>["posts"];

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

const GET_ORGANIZATIONS_QUERY = `
  query GetOrganizations {
    account {
      organizations {
        id
        limits {
          scheduledPosts
        }
      }
    }
  }
`;

const GET_SCHEDULED_POSTS_COUNT_QUERY = `
  query GetScheduledPostsCount($first: Int!, $after: Cursor, $input: PostsInput!) {
    posts(first: $first, after: $after, input: $input) {
      totalCount
      edges {
        node {
          id
          dueAt
          status
          channelId
        }
      }
      pageInfo {
        hasNextPage
        endCursor
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

type ScheduledPostsCountSuccessResult = {
  ok: true;
  count: number;
  limit: number | null;
};

type ScheduledPostsCountFailureResult = {
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

export async function getScheduledPostsCount(): Promise<
  ScheduledPostsCountSuccessResult | ScheduledPostsCountFailureResult
> {
  const apiKey = process.env.BUFFER_API_KEY;
  const channelId = process.env.BUFFER_PINTEREST_CHANNEL_ID;

  if (!apiKey || !channelId) {
    return {
      ok: false,
      message: "Buffer API configuration is missing.",
    };
  }

  try {
    const organizationsResult = await runBufferQuery<OrganizationsGraphQLResponse>(apiKey, {
      query: GET_ORGANIZATIONS_QUERY,
    });

    if (Array.isArray(organizationsResult.errors) && organizationsResult.errors.length > 0) {
      console.error("Buffer organization GraphQL errors:", organizationsResult.errors);

      return {
        ok: false,
        message: "Failed to load scheduled post count.",
      };
    }

    const organization = organizationsResult.data?.account?.organizations?.find(
      (item): item is { id: string; limits?: { scheduledPosts?: number | null } | null } =>
        typeof item?.id === "string" && item.id.length > 0
    );

    if (!organization) {
      return {
        ok: false,
        message: "Failed to load scheduled post count.",
      };
    }

    const scheduledPostsResult = await runBufferQuery<ScheduledPostsGraphQLResponse>(apiKey, {
      query: GET_SCHEDULED_POSTS_COUNT_QUERY,
      variables: {
        first: 1,
        after: null,
        input: {
          organizationId: organization.id,
          filter: {
            status: ["scheduled"],
            channelIds: [channelId],
          },
        },
      },
    });

    if (Array.isArray(scheduledPostsResult.errors) && scheduledPostsResult.errors.length > 0) {
      console.error("Buffer scheduled posts GraphQL errors:", scheduledPostsResult.errors);

      return {
        ok: false,
        message: "Failed to load scheduled post count.",
      };
    }

    const posts = scheduledPostsResult.data?.posts;
    const count = await resolveScheduledPostsCount({
      apiKey,
      organizationId: organization.id,
      channelId,
      posts,
    });

    return {
      ok: true,
      count,
      limit: typeof organization.limits?.scheduledPosts === "number" ? organization.limits.scheduledPosts : null,
    };
  } catch (error) {
    console.error("Buffer scheduled count request failed:", error);

    return {
      ok: false,
      message: "Failed to load scheduled post count.",
    };
  }
}

async function runPinterestBoardsQuery(
  apiKey: string,
  channelId: string,
  query: string
): Promise<PinterestBoardsGraphQLResponse> {
  return runBufferQuery<PinterestBoardsGraphQLResponse>(apiKey, {
    query,
    variables: {
      input: {
        id: channelId,
      },
    },
  });
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

async function runBufferQuery<T>(
  apiKey: string,
  payload: {
    query: string;
    variables?: Record<string, unknown>;
  }
): Promise<T> {
  const response = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  return (await response.json()) as T;
}

async function resolveScheduledPostsCount({
  apiKey,
  organizationId,
  channelId,
  posts,
}: {
  apiKey: string;
  organizationId: string;
  channelId: string;
  posts?: ScheduledPostsConnection | null;
}): Promise<number> {
  if (typeof posts?.totalCount === "number") {
    return posts.totalCount;
  }

  let count = Array.isArray(posts?.edges) ? posts.edges.length : 0;
  let cursor = posts?.pageInfo?.endCursor ?? null;
  let hasNextPage = posts?.pageInfo?.hasNextPage === true;

  while (hasNextPage) {
    const nextPage = await runBufferQuery<ScheduledPostsGraphQLResponse>(apiKey, {
      query: GET_SCHEDULED_POSTS_COUNT_QUERY,
      variables: {
        first: 100,
        after: cursor,
        input: {
          organizationId,
          filter: {
            status: ["scheduled"],
            channelIds: [channelId],
          },
        },
      },
    });

    if (Array.isArray(nextPage.errors) && nextPage.errors.length > 0) {
      console.error("Buffer scheduled posts pagination GraphQL errors:", nextPage.errors);
      break;
    }

    count += Array.isArray(nextPage.data?.posts?.edges) ? nextPage.data.posts.edges.length : 0;
    cursor = nextPage.data?.posts?.pageInfo?.endCursor ?? null;
    hasNextPage = nextPage.data?.posts?.pageInfo?.hasNextPage === true;
  }

  return count;
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
