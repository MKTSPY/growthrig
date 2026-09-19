export interface ThreadPost {
  id: string;
  source: "hackernews";
  title: string;
  body: string;
  url: string;
  author: string;
  community: string;
  score: number;
  comments: number;
  created_utc: number;
  fetched_at: string;
}

export interface DraftedReply {
  content: string;
  source_post: ThreadPost;
  citations: string[];
}

export interface DiscoverResult {
  posts: ThreadPost[];
  errors: string[];
}
