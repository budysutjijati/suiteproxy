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
const excludedIPRanges = ['127.0.0.1', '::1','45.88.10.78', '192.168.1.0/24']; // Add fixed IPs or ranges here

// Predefined arrays of allowed IDs
const allowedTransactionIds = [10410]; // Add valid transaction IDs here
const allowedCustomerIds = [1397]; // Add valid customer IDs here

// Allowed start and end dates for statements
const allowedStartDate = '01/01/2025';
const allowedEndDate = '31/01/2025';

// Rate limiting configuration
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15-minute window
	max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 5, // Default to 5 requests if env variable is missing
	message: {
		error: 'Too many requests. Please try again later.',
	},
	skip: (req, res) => {
		let clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;

		console.log(clientIp);

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
		const { type, id, customerid, start, end, file } = req.query;

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
			if (isNaN(parsedId) || !allowedTransactionIds.includes(parsedId)) {
				return res.status(400).json({ error: 'Invalid or unauthorized transaction ID.' });
			}

			restletUrl.searchParams.append('id', parsedId);

			// If file=pdf, return the PDF file
			if (file && file.toLowerCase() === 'pdf') {
				// Make a GET request to the RESTlet using the NetSuite API client
				const response = await netsuiteAPI.get({ url: restletUrl.toString() });

				// Validate and retrieve the base64 content
				const base64Content = response?.data?.base64;
				if (!base64Content) {
					return res.status(400).json({ error: 'No PDF content available for this transaction.' });
				}

				// Convert base64 to binary data and send as a downloadable PDF file
				const pdfBuffer = Buffer.from(base64Content, 'base64');
				res.setHeader('Content-Type', 'application/pdf');
				res.setHeader(
					'Content-Disposition',
					// `attachment; filename=transaction_${parsedId}.pdf`
					'inline'
				);
				return res.status(200).send(pdfBuffer);
			}
		}
		// Handle statement requests
		else if (type === 'statement') {
			if (!customerid) {
				return res.status(400).json({ error: 'Missing required query parameter: customerid.' });
			}

			const parsedCustomerId = parseInt(customerid, 10);
			if (isNaN(parsedCustomerId) || !allowedCustomerIds.includes(parsedCustomerId)) {
				return res.status(400).json({ error: 'Invalid or unauthorized customer ID.' });
			}

			restletUrl.searchParams.append('customerid', parsedCustomerId);

			// Validate start date
			if (!start) {
				return res.status(400).json({ error: 'Missing required query parameter: start.' });
			}
			if (start !== allowedStartDate) {
				return res.status(400).json({
					error: `Invalid start date. Only ${allowedStartDate} is allowed.`,
				});
			}
			restletUrl.searchParams.append('start', start);

			// Validate end date
			if (!end) {
				return res.status(400).json({ error: 'Missing required query parameter: end.' });
			}
			if (end !== allowedEndDate) {
				return res.status(400).json({
					error: `Invalid end date. Only ${allowedEndDate} is allowed.`,
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