import sharp from'sharp';
import {redirect} from './redirect.js';

export async function compressImg(request, reply, imgStream) {
    const { webp, grayscale, quality, originSize } = request.params;
    const imgFormat = webp ? 'webp' : 'jpeg';

    try {
        // Create the sharp instance and start the pipeline
        const sharpStream = sharp()
            .grayscale(grayscale) // Apply grayscale conditionally
            .toFormat(imgFormat, {
                quality, // Use the provided quality
                progressive: true,
                optimizeScans: webp, // Optimize scans only for WebP
                chromaSubsampling: webp ? '4:4:4' : '4:2:0', // Conditional chroma subsampling
            });

        // Pipe the input stream through the sharp instance
        const { data, info } = await new Promise((resolve, reject) => {
            const buffers = [];
            imgStream.pipe(sharpStream)
                .on('data', chunk => buffers.push(chunk))
                .on('end', () => resolve(Buffer.concat(buffers)))
                .on('info', resolve)
                .on('error', reject);
        });

        // Send response with appropriate headers
        reply
            .header('content-type', `image/${imgFormat}`)
            .header('content-length', info.size)
            .header('x-original-size', originSize)
            .header('x-bytes-saved', originSize - info.size)
            .code(200)
            .send(data);
    } catch (error) {
        return redirect(request, reply);
    }
}

