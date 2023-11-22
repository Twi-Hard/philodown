export interface Comment {
	id: number;
	image_id: number;
	user_id: number;
	author: string;
	avatar: string;
	body: string;
	created_at: Date;
	updated_at: Date;
	edited_at: number;
	edit_reason: string;
}

export interface Image {
	id: number;
	created_at: Date;
	updated_at: Date;
	first_seen_at: Date;
	width: number;
	height: number;
	mime_type: string;
	format: string;
	aspect_ratio: number;
	name: string;
	sha512_hash: string;
	orig_sha512_hash: string;
	tags: string[];
	tag_ids: number[];
	uploader: string;
	uploader_id: number;
	wilson_score: number;
	intensities: {
		nw: number;
		ne: number;
		sw: number;
		se: number;
	} | null;
	score: number;
	upvotes: number;
	downvotes: number;
	faves: number;
	comment_count: number;
	tag_count: number;
	description: string;
	source_url: string;
	view_url: string;
	representations: {
		full: string;
		large: string;
		medium: string;
		small: string;
		tall: string;
		thumb: string;
		thumb_small: string;
		thumb_tiny: string;
	};
	spoilered: boolean;
	thumbnails_generated: boolean;
	processed: boolean;
	deletion_reason: string | null;
	duplicate_of: number | null;
	hidden_from_users: boolean;
}

export interface CommentCreateEvent {
	comment: Comment;
}

export interface ImageCreateEvent {
	image: Image;
}

export interface ImageDescriptionUpdateEvent {
	image_id: number;
	added: string;
	removed: string;
}

export interface ImageUpdateEvent {
	image: Image;
}

export interface ImageTagUpdateEvent {
	image_id: number;
	added: string[];
	removed: string[];
}

export interface ImageProcessEvent {
	image_id: number;
}
