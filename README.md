# Bitespeed Identity Reconciliation

This project implements the Bitespeed backend task for identity reconciliation. It exposes a POST /identify endpoint to consolidate customer identities based on email and phone number.

## Setup

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd bitespeed-identity-reconciliation
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Generate Prisma client:
   ```bash
   npx prisma generate
   ```
4. Run database migration:
   ```bash
   npx prisma migrate dev --name init
   ```
5. Start the server:
   ```bash
   npm run dev
   ```

## API Usage

POST `/identify`

Request body (JSON):
```
{
  "email": "string (optional)",
  "phoneNumber": "string (optional)"
}
```

Example:
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"doc@brown.com","phoneNumber":"123456"}'
```

## Example Usage

POST `/identify`

Request:
```json
{
  "email": "doc@brown.com",
  "phoneNumber": "123456"
}
```

Response:
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["doc@brown.com"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": []
  }
}
```

## Root URL

Visiting the root URL (`/`) in a browser will show a health check message. To use the API, send a POST request to `/identify` with a JSON body as shown above.

