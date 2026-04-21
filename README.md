# StockPilot

StockPilot is a responsive full-stack mini project for Web Technology Lab. It demonstrates a business-focused web application for a small retail store using simple technologies instead of complex frameworks.

The app helps a business:

- manage product inventory
- record daily sales
- monitor low-stock items
- review recent sales activity
- use a clean interface in both light mode and dark mode

## Tech Stack

- `HTML5`
- `CSS3`
- `Vanilla JavaScript`
- `Node.js` built-in `http` server for the backend
- JSON file storage for persistent demo data

## Key Improvements

- Better accessibility with keyboard focus states, skip link, semantic structure, visible labels, and stronger contrast
- More scalable responsive sizing using rem-based spacing and typography
- Light and dark mode toggle with saved theme preference
- Simple backend API for products, sales, and reset actions
- Data persistence in `data/store.json` instead of browser-only storage

## Features

- Add new products with name, category, price, quantity, and low-stock limit
- Record sales and automatically reduce inventory quantity
- Show live summary cards for product count, total units, revenue, and low-stock alerts
- Search inventory by product name or category
- View recent sales and restock notifications
- Reset the app back to demo data

## Project Structure

```text
stockpilot/
|-- index.html
|-- style.css
|-- script.js
|-- server.js
|-- package.json
|-- data/
|   `-- store.json
`-- README.md
```

## API Endpoints

The backend exposes a small REST-like API:

- `GET /api/dashboard` returns products and sales
- `POST /api/products` creates a product
- `POST /api/sales` records a sale
- `DELETE /api/products/:id` deletes a product and related sales
- `POST /api/reset` restores the demo dataset

## Run Locally

1. Open a terminal in the project folder.
2. Start the server:

```bash
npm start
```

3. Open:

```text
http://localhost:3000
```

## Push To GitHub Repo

Use your target repository:

```text
https://github.com/vedant27-lab/stockpilot.git
```

Example commands:

```bash
git init
git branch -M main
git remote add origin https://github.com/vedant27-lab/stockpilot.git
git add .
git commit -m "Build accessible full-stack StockPilot app"
git push -u origin main
```

## Hosting Options

Because this project has a Node backend, use a host that supports Node.js server apps.

### Render

1. Push the project to the GitHub repository.
2. Sign in to Render.
3. Create a new Web Service from the GitHub repo.
4. Use:
   Start Command: `npm start`
5. Deploy and use the generated public URL.

### Railway

1. Push the project to GitHub.
2. Import the repository into Railway.
3. Deploy with the default Node.js detection.

## Suggested Mini Project Description

StockPilot is a dynamic and accessible inventory and sales management web application developed using HTML, CSS, JavaScript, and Node.js. It allows a small business to maintain product records, track sales, identify low-stock items, and use a modern responsive interface with theme support.
