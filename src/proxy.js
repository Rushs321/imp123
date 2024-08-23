import fetch from 'node-fetch';
import lodash from 'lodash'; // Directly import the pick function
import { generateRandomIP, randomUserAgent } from './utils';
import {copyHdrs} from './copyHeaders';
import {applyCompression} from './compress';
import {performBypass} from './bypass';
import {handleRedirect} from './redirect';
import {checkCompression} from './shouldCompress';

const viaHeaders = [
    '1.1 example-proxy-service.com (ExampleProxy/1.0)',
    '1.0 another-proxy.net (Proxy/2.0)',
    '1.1 different-proxy-system.org (DifferentProxy/3.1)',
    '1.1 some-proxy.com (GenericProxy/4.0)',
];

function randomVia() {
    const index = Math.floor(Math.random() * viaHeaders.length);
    return viaHeaders[index];
}

export async function processRequest(request, reply) {
    const { url, jpeg, bw, l } = request.query;

    if (!url) {
        const ipAddress = generateRandomIP();
        const ua = randomUserAgent();
        const hdrs = {
            ...pick(request.headers, ['cookie', 'dnt', 'referer']),
            'x-forwarded-for': ipAddress,
            'user-agent': ua,
            'via': randomVia(),
        };

        Object.entries(hdrs).forEach(([key, value]) => reply.header(key, value));
        
        return reply.send(`1we23`);
    }

    const urlList = Array.isArray(url) ? url.join('&url=') : url;
    const cleanUrl = urlList.replace(/http:\/\/1\.1\.\d\.\d\/bmi\/(https?:\/\/)?/i, 'http://');

    request.params.url = cleanUrl;
    request.params.webp = !jpeg;
    request.params.grayscale = bw !== '0';
    request.params.quality = parseInt(l, 10) || 40;

    const randomIP = generateRandomIP();
    const userAgent = randomUserAgent();

    try {
        const response = await fetch(request.params.url, {
            headers: {
                ...lodash.pick(request.headers, ['cookie', 'dnt', 'referer']),
                'user-agent': userAgent,
                'x-forwarded-for': randomIP,
                'via': randomVia(),
            },
            timeout: 10000,
            follow: 5, // max redirects
            compress: true,
        });

        if (!response.ok) {
            return handleRedirect(request, reply);
        }

        copyHdrs(response, reply);
        reply.header('content-encoding', 'identity');
        request.params.originType = response.headers.get('content-type') || '';
        request.params.originSize = parseInt(response.headers.get('content-length'), 10) || 0;

        if (checkCompression(request)) {
            const buffer = await response.buffer();
            return applyCompression(request, reply, buffer);
        } else {
            // Directly pipe the response stream to the client
            reply.header('content-length', request.params.originSize);
            return response.body.pipe(reply.raw);
        }
    } catch (err) {
        return handleRedirect(request, reply);
    }
}

module.exports = processRequest;
