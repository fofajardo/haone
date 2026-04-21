<p align="center">
  <img src="static/ha1.svg" alt="HAOne Logo" width="120" />
</p>

# HAOne

A high-performance, premium institutional platform for managing resident data, financial journals, and facility operations. Built with modern web standards and a focus on visual excellence.

## Features

- **Financial Ledger**: Real-time management of water fees, association dues, and miscellaneous transactions with Google Sheets persistence.
- **Resident Management**: Comprehensive directory with room assignments, bed tracking, and academic profile history.
- **Automated Receipts**: Dynamic PDF generation for payment receipts and clearance documents.
- **Facility Booking**: Integrated laundry reservation system with real-time availability tracking.
- **Communication**: Automated email dispatching via Gmail API for status updates and notifications.

## Tech Stack

- **Framework**: [SvelteKit 2.0](https://kit.svelte.dev/) + [Svelte 5 (Runes)](https://svelte.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **UI Components**: [shadcn-svelte](https://www.shadcn-svelte.com/) + [Bits UI](https://bits-ui.com/)
- **Backend/Persistence**: Google Sheets API V4 + Cloudflare Workers
- **Visualization**: Three.js + LayerChart
- **Editor**: Tiptap Rich Text Editor
- **Deployment**: [Cloudflare Pages](https://pages.cloudflare.com/)

## Getting Started

### Prerequisites

- [pnpm](https://pnpm.io/) (Mandatory)
- Admin Google Cloud Project (Sheets and Gmail APIs enabled)
- Resident Google Cloud Project (Google Identity Services / Auth only)
- Cloudflare Account

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd haone
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Configure environment variables:
   Copy `.env.example` to `.env` and fill in your credentials.

4. Start the development server:
   ```bash
   pnpm dev
   ```

## Deployment

The project is optimized for deployment on Cloudflare Pages using Wrangler.

```bash
pnpm build
pnpm wrangler pages deploy .svelte-kit/cloudflare
```
