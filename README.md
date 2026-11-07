# Order Desk

A React client for the Spring Boot Order service. It includes an HTTP Basic login UI, order listing/search, create, partial update, full replacement, delete, and service health status. Credentials are held in `sessionStorage` for the current browser tab and sent in the `Authorization` header.

## Run locally

1. Set the backend URL in `.env` (copy `.env.example`):

   ```env
   VITE_API_BASE_URL=http://localhost:8080/api/v1/orders
   ```

2. Install dependencies and start Vite:

   ```sh
   npm install
   npm run dev
   ```

The app expects these endpoints:

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/` | Return an array of orders, or a page object with `content` |
| `GET` | `/health` | Return a successful response when the service is healthy |
| `POST` | `/` | Create an order from `{ "customerName", "product", "quantity" }` |
| `PUT` | `/{id}` | Replace an order with all fields supplied |
| `PATCH` | `/{id}` | Update the supplied non-empty fields |
| `DELETE` | `/{id}` | Delete the order |

The API should allow the Vite origin (usually `http://localhost:5173`) through Spring CORS configuration. For example, configure CORS for your controller or a `WebMvcConfigurer` and restrict allowed origins to the deployed frontend origin in production. The frontend sends JSON for POST and PATCH and expects order objects to expose `id`, `customerName`, `product`, and `quantity`; `createdAt`, `orderDate`, or `date` are optional display fields.
