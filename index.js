require('dotenv').config(); // Load environment variables
const express = require('express');
const rateLimit = require('express-rate-limit');
const ipRangeCheck = require('ip-range-check');
const NetSuiteAPI = require('netsuite-api');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');

// Extend Day.js with the CustomParseFormat plugin
dayjs.extend(customParseFormat);

const app = express();
const PORT = process.env.PORT || 3000;

// Define the fixed IP ranges to exclude (wildcards or CIDR notation)
const excludedIPRanges = ['95.99.68.87', '192.168.222.0/24']; // Add fixed IPs or ranges here

// Rate limiting configuration
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15-minute window
	max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 5, // Default to 5 requests if env variable is missing
	message: {
		error: 'Too many requests. Please try again later.',
	},
	skip: (req, res) => {
		let clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;

		// Normalize IPv6 loopback to IPv4
		if (clientIp === '::1') {
			clientIp = '127.0.0.1';
		}

		return ipRangeCheck(clientIp, excludedIPRanges); // Skip rate limiting if IP is excluded
	},
});

// Apply rate limiter to all routes
app.use(limiter);

// NetSuite API configuration
const config = {
	ACCOUNT_ID: process.env.ACCOUNT_ID,
	CONSUMER_KEY: process.env.CONSUMER_KEY,
	CONSUMER_SECRET: process.env.CONSUMER_SECRET,
	TOKEN_ID: process.env.TOKEN_ID,
	TOKEN_SECRET: process.env.TOKEN_SECRET,
};

const netsuiteAPI = new NetSuiteAPI(config);

/**
 * SuiteProxy route
 */
app.get('/suiteproxy', async (req, res) => {
	try {
		// Extract query parameters
		const { type, id, customerid, start, end } = req.query;

		// Validate the "type" parameter
		if (!type) {
			return res.status(400).json({ error: 'Missing required query parameter: type.' });
		}

		// Construct the RESTlet URL
		const restletUrl = new URL(`${process.env.RESTLET_URL}`);
		restletUrl.searchParams.append('type', type);

		// Handle transaction requests
		if (type === 'transaction') {
			if (!id) {
				return res.status(400).json({ error: 'Missing required query parameter: id.' });
			}

			const parsedId = parseInt(id, 10);
			if (isNaN(parsedId)) {
				return res.status(400).json({ error: 'Invalid id. Must be a valid number.' });
			}

			restletUrl.searchParams.append('id', parsedId);
		}
		// Handle statement requests
		else if (type === 'statement') {
			if (!customerid) {
				return res.status(400).json({ error: 'Missing required query parameter: customerid.' });
			}

			const parsedCustomerId = parseInt(customerid, 10);
			if (isNaN(parsedCustomerId)) {
				return res.status(400).json({ error: 'Invalid customerid. Must be a valid number.' });
			}

			restletUrl.searchParams.append('customerid', parsedCustomerId);

			// Validate and append start date
			if (!start) {
				return res.status(400).json({ error: 'Missing required query parameter: start.' });
			}
			if (!dayjs(start, 'DD/MM/YYYY', true).isValid()) {
				return res.status(400).json({
					error: `Invalid start format. Expected DD/MM/YYYY but received: ${start}.`,
				});
			}
			restletUrl.searchParams.append('start', start);

			// Validate and append end date
			if (!end) {
				return res.status(400).json({ error: 'Missing required query parameter: end.' });
			}
			if (!dayjs(end, 'DD/MM/YYYY', true).isValid()) {
				return res.status(400).json({
					error: `Invalid end format. Expected DD/MM/YYYY but received: ${end}.`,
				});
			}
			restletUrl.searchParams.append('end', end);
		} else {
			return res.status(400).json({ error: 'Invalid type. Valid values are "transaction" or "statement".' });
		}

		// Make a GET request to the RESTlet using the NetSuite API client
		const response = await netsuiteAPI.get({ url: restletUrl.toString() });

		// Relay the RESTlet response to the client
		return res.status(200).json(response);
	} catch (error) {
		console.error(`Error relaying request to NetSuite: ${error.message}`);
		return res.status(500).json({
			error: 'Error communicating with NetSuite RESTlet.',
			details: error.message,
		});
	}
});

// Start the server
app.listen(PORT, () => {
	console.log(`SuiteProxy server is running at http://localhost:${PORT}`);
});