# SuiteProxy

SuiteProxy is a lightweight middleware application that securely interacts with NetSuite RESTlets to retrieve transactions and customer statements. It provides features such as rate limiting, IP-based exclusions, and data validation to ensure secure and controlled access.

---

## Features

- **Transaction Retrieval**: Retrieve details or files (PDFs) for specific transactions using their IDs.
- **Customer Statements**: Generate statements for authorized customers within predefined date ranges.
- **Rate Limiting**: Protects the server by limiting requests (default: 5 per 15 minutes).
- **IP Exclusion**: Allows trusted IPs to bypass rate limiting.
- **PDF Handling**: Converts base64-encoded PDF data from NetSuite into downloadable files.
- **NetSuite Integration**: Uses `netsuite-api` for seamless communication with NetSuite RESTlets.

---

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/suiteproxy.git
   cd suiteproxy

2. Install dependencies:
   ```bash
   npm install

3. Create a .env file in the root directory with the following variables:

   ```
   PORT=3000
   RATE_LIMIT_MAX=5
   ACCOUNT_ID=your_netsuite_account_id
   CONSUMER_KEY=your_netsuite_consumer_key
   CONSUMER_SECRET=your_netsuite_consumer_secret
   TOKEN_ID=your_netsuite_token_id
   TOKEN_SECRET=your_netsuite_token_secret
   RESTLET_URL=your_netsuite_restlet_url

## Usage
1. Start the server:
   ```bash
   npm start

2. In development mode (auto-restart on changes):
   ```bash
   npm run dev


3. Access the application at:
   ```
   http://localhost:3000/suiteproxy

## API Endpoints

    GET /suiteproxy

Interact with NetSuite RESTlets to retrieve transactions or customer statements.

### Query Parameters:

| Parameter    | Required | Type   | Description                                                                 |
|--------------|----------|--------|-----------------------------------------------------------------------------|
| `type`       | Yes      | String | Type of request: `transaction` or `statement`.                             |
| `id`         | No       | Number | Transaction ID (required for `transaction` type).                         |
| `customerid` | No       | Number | Customer ID (required for `statement` type).                              |
| `start`      | No       | String | Start date for the statement (required for `statement` type, e.g., `01/01/2025`). |
| `end`        | No       | String | End date for the statement (required for `statement` type, e.g., `31/01/2025`).   |
| `file`       | No       | String | Set to `pdf` to download the transaction as a PDF (only for `transaction`).   |


## Example Requests:
1. Retrieve a transaction:
   ```
   GET /suiteproxy?type=transaction&id=10410

2. Retrieve a transaction PDF:
   ```
   GET /suiteproxy?type=transaction&id=10410&file=pdf

3. Retrieve a customer statement:
   ```
   GET /suiteproxy?type=statement&customerid=1397&start=01/01/2025&end=31/01/2025

**Response:**
- Success: JSON data or PDF file.
- Error: JSON error message with details.

## Security Features
1.	Rate Limiting:
- Default: 5 requests per 15 minutes.
- Configurable using the RATE_LIMIT_MAX environment variable.
2.	IP Exclusion:
- Bypasses rate limiting for trusted IPs or ranges defined in excludedIPRanges.
3.	Data Validation:
- Allows only predefined transaction IDs, customer IDs, and date ranges.

## Dependencies
- express: Web framework.
- dotenv: Loads environment variables.
- express-rate-limit: Implements rate limiting.
- ip-range-check: Checks IPs against defined ranges.
- dayjs: Handles date parsing and validation.
- netsuite-api: Simplifies communication with NetSuite RESTlets.