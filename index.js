require('dotenv').config(); // Load environment variables

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit'); // Import rate limiter
const ipRangeCheck = require('ip-range-check'); // Import IP range checker
const NetSuiteAPI = require('netsuite-api');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Define the fixed IP ranges to exclude (wildcards or CIDR notation)
const excludedIPRanges = ['95.99.68.87', '192.168.222.0/24', '127.0.0.1']; // Add fixed IPs or ranges here

// Rate limiting configuration
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15-minute window
	max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 5, // Default to 5 requests if the environment variable is not set
	message: {
		error: 'Too many requests. Please try again later.',
	},
	skip: (req, res) => {
		const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.ip; // Use x-forwarded-for or fallback to req.ip
		const isExcluded = ipRangeCheck(clientIp, excludedIPRanges); // Check if IP is in the excluded list
		console.log(`Client IP: ${clientIp}, Is Excluded: ${isExcluded}`); // Debug log
		return isExcluded; // Skip rate limiting if IP is excluded
	},
});

// Apply rate limiter to all requests
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
 * Proxy endpoint
 */
app.get('/suiteproxy', async (req, res) => {
	try {
		// Extract transaction ID from query parameters
		const { transactionid } = req.query;

		// Validate transaction ID
		if (!transactionid) {
			return res.status(400).json({
				error: 'Missing required query parameter: transactionid.',
			});
		}

		const parsedTransactionId = parseInt(transactionid, 10);

		if (isNaN(parsedTransactionId)) {
			return res.status(400).json({
				error: 'Invalid transactionid. Must be a valid number.',
			});
		}

		// Construct the RESTlet URL using the provided transaction ID
		const restletUrl = `${process.env.RESTLET_URL}&transactionid=${parsedTransactionId}`;

		// Make a GET request to the RESTlet using the NetSuite API client
		const response = await netsuiteAPI.get({
			url: restletUrl,
		});

		// Relay the RESTlet response to the client
		return res.status(200).json(response);
	} catch (error) {
		console.error('Error relaying request to NetSuite:', error.message);
		return res.status(500).json({
			error: 'Error communicating with NetSuite RESTlet.',
			details: error.message,
		});
	}
});

// Start the server
app.listen(PORT, () => {
	console.log(`Proxy server is running at http://localhost:${PORT}`);
});