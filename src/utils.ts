import fs from "fs/promises";
import { createWriteStream } from "fs";
import { extname, join } from "path";
import { outputPaths } from "./index";
import { Image } from "./interfaces";
import config from "../config.json";
import { pipeline } from "stream";
import { promisify } from "util";
import * as fetch from "node-fetch";

const streamPipeline = promisify(pipeline);

export async function fetchMetadata(id: number): Promise<Image> {
	return await fetch(
		`http${config.https && "s"}://${
			config.origin
		}/api/v1/json/images/${id}?key=${config.apiKey}`
	)
		.then((res: { json: () => any }) => res.json())
		.then((res: { image: any }) => res.image)
		.then((image: Image) => {
			image.created_at = new Date(image.created_at);
			image.updated_at = new Date(image.updated_at);
			image.first_seen_at = new Date(image.first_seen_at);
			return image;
		})
		.catch((err: any) => err);
}

export async function getImageMetadata(
	id: number,
	fetchIfMissing: boolean = true
) {
	return await fs
		.readFile(join(outputPaths.imageMetadata, `${id}.json`), "utf8")
		.then(JSON.parse, async (err) => {
			if (err.code === "ENOENT" && fetchIfMissing) {
				// Assume we can fetch the metadata now
				return await fetchMetadata(id);
			}
		});
}

export async function saveImageMetadata(image: Image) {
	return fs.writeFile(
		join(
			outputPaths.imageMetadata,
			`${image.id}_${Date.now()}.json`
		),
		JSON.stringify(image),
		"utf8"
	);
}

export async function downloadImage(
	id: number,
	metadata?: Image,
	iteration: number = 1
) {
	// Rare that we'd need to retry
	if (iteration > 1) {
		if (iteration > config.maxDownloadAttempts) return;
		console.warn(
			`Retrying image download for ${
				id || metadata?.id
			}; attempt ${iteration}/${config.maxDownloadAttempts}`
		);
	}
	metadata = metadata || (await fetchMetadata(id));
	if (metadata.representations?.full == null) {
		setTimeout(async () => {
			console.error(
				`Could not find full image representation for ${id}}.`
			);
			await downloadImage(id, metadata, iteration + 1);
		}, config.downloadAttemptRetryTime);
		return;
	}
	const image = await fetch(metadata.representations.full).catch(
		(err: any) => err
	);
	if (
		image == null ||
		image instanceof Error ||
		image.toString().startsWith("<html>")
	) {
		setTimeout(async () => {
			const reason =
				image == null
					? "Image is null"
					: image instanceof Error
					? "Image is error"
					: image.toString().startsWith("<html>")
					? "Image is HTML"
					: "Unknown";
			console.error(`Could not get image ${id}. (${reason})`);
			await downloadImage(id, metadata, iteration + 1);
		}, config.downloadAttemptRetryTime);
		return;
	}
	const extension = extname(metadata.representations.full);
	const writeStream = createWriteStream(
		join(
			outputPaths.images,
			`${metadata.id}_${Date.now()}${extension}`
		)
	);
	// @ts-ignore
	await streamPipeline(image.body, writeStream);
}
