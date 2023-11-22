import WebSocket from "ws";

import config from "../config.json";
import {
	Comment,
	CommentCreateEvent,
	ImageDescriptionUpdateEvent,
	Image,
	ImageCreateEvent,
	ImageProcessEvent,
	ImageTagUpdateEvent,
	ImageUpdateEvent,
} from "./interfaces";
import { Arguments, outputPaths } from "./index";
import { join } from "path";
import * as fs from "fs/promises";
import { existsSync } from "fs";
import { downloadImage, fetchMetadata, saveImageMetadata } from "./utils";

const startDate = new Date(
	new Date(new Date().toUTCString()).getTime() - 1000 * config.gracePeriodMins
);

const joinEvent = [0, 0, "firehose", "phx_join", {}];
const heartbeatEvent = [0, 0, "phoenix", "heartbeat", {}];

export async function live(argv: Arguments) {
	const ws = new WebSocket(
		`wss://${config.origin}/socket/websocket?vsn=2.0.0&key=${config.apiKey}`,
		{
			headers: {
				Origin: `http${config.https && "s"}://${config.origin}/`,
				"User-Agent": "PhiloDown/v0.1.0",
			},
		}
	);

	ws.on("open", () => {
		console.debug(new Date(), "WebSocket opened");
		ws.send(JSON.stringify(joinEvent));
		setInterval(() => ws.send(JSON.stringify(heartbeatEvent)), 30000);
	});

	ws.on("message", async (data: string) => {
		let [joinRef, ref, topic, event, payload] = JSON.parse(data);

		console.debug(new Date(), event);

		switch (event) {
			case "comment:create":
				await handleCommentCreateEvent(
					(payload as CommentCreateEvent).comment
				);
				break;
			case "image:create":
				await handleImageCreateEvent(
					(payload as ImageCreateEvent).image
				);
				break;
			case "image:description_update":
				await handleDescriptionUpdateEvent(
					payload as ImageDescriptionUpdateEvent
				);
				break;
			case "image:update":
				await handleImageUpdateEvent(
					(payload as ImageUpdateEvent).image
				);
				break;
			case "image:tag_update":
				await handleImageTagUpdateEvent(payload as ImageTagUpdateEvent);
				break;
			case "image:process":
				await handleImageProcessEvent(
					(payload as ImageProcessEvent).image_id
				);
				break;
		}
	});

	ws.on("close", (code) => {
		// CloudFlare will close our connection with code 1001 and 1006 after some point.
		// We should be fine re-establishing. Hopefully nothing happens between.
		console.error(new Date(), "WebSocket closed with code", code);
		live(argv);
	});

	ws.on("error", (err) => {
		console.error(new Date(), "WebSocket threw error", err.message);
	});
}

async function handleCommentCreateEvent(comment: Comment) {
	await fs.writeFile(
		join(outputPaths.commentMetadata, `${comment.id}.json`),
		JSON.stringify(comment),
		"utf8"
	);
}

async function handleDescriptionUpdateEvent(
	event: ImageDescriptionUpdateEvent
) {
	// Description is also updated on image:updated
}

async function handleImageCreateEvent(image: Image) {
	if (
		!config.onlyNewMetadata ||
		(config.onlyNewMetadata && new Date(image.created_at) > startDate)
	) {
		await saveImageMetadata(image);
	}
}

async function handleImageUpdateEvent(image: Image) {
	if (
		!config.onlyNewMetadata ||
		(config.onlyNewMetadata && new Date(image.created_at) > startDate)
	) {
		await saveImageMetadata(image);
	}
	if (
		image.processed &&
		!existsSync(join(outputPaths.images, `${image.id}.${image.format}`))
	) {
		if (
			!config.onlyNewImages ||
			(config.onlyNewImages && new Date(image.created_at) > startDate)
		) {
			await downloadImage(image.id);
		}
	}
}

async function handleImageTagUpdateEvent(event: ImageTagUpdateEvent) {
	// Tags are also updated on image:updated
}

async function handleImageProcessEvent(id: number) {
	// We need to fetch the metadata because representations need to be filled
	const metadata = await fetchMetadata(id);
	if (
		!config.onlyNewMetadata ||
		(config.onlyNewMetadata && metadata.created_at > startDate)
	) {
		await saveImageMetadata(metadata);
	}
	if (
		!config.onlyNewImages ||
		(config.onlyNewImages && metadata.created_at > startDate)
	) {
		await downloadImage(null, metadata);
	}
}
