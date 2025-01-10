require('dotenv').config(); // Load environment variables

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit'); // Import rate limiter
const ipRangeCheck = require('ip-range-check'); // Import IP range checker
const NetSuiteAPI = require('netsuite-api');
const dns = require('dns');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Define the IP ranges to exclude (wildcards or CIDR notation)
const excludedIPRanges = ['192.168.222.*'];

dns.lookup(process.env.DDNS, (err, address) => {
	if (!err) {
		excludedIPRanges.push(address);
		console.log(`Resolved home IP: ${address}`);
	}
});

// Rate limiting configuration
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15-minute window
	max: process.env.RATE_LIMIT_MAX, // Limit each IP to 15 requests per window
	message: {
		error: 'Too many requests. Please try again later.',
	},
	skip: (req, res) => {
		return ipRangeCheck(req.ip, excludedIPRanges); // Exclude matching IP ranges
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
 * Hardcoded transaction ID example
 */
app.get('/suiteproxy', async (req, res) => {
	try {
		// Hardcoded transaction ID
		const hardcodedTransactionId = 2615;

		// Construct the RESTlet URL using the updated RESTLET_URL from .env
		const restletUrl = `${process.env.RESTLET_URL}&transactionid=${hardcodedTransactionId}`;

		// Make a GET request to the RESTlet using the NetSuite API client
		const response = await netsuiteAPI.get({
			url: restletUrl,
		});

		// Relay the RESTlet response to the client
		res.status(200).json(response);
	} catch (error) {
		console.error('Error relaying request to NetSuite:', error.message);
		res.status(500).json({
			error: 'Error communicating with NetSuite RESTlet',
			details: error.message,
		});
	}
});

// Start the server
app.listen(PORT, () => {
	console.log(`Proxy server is running at http://localhost:${PORT}`);
});