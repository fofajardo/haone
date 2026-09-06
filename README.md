<p align="center">
  <img src="static/ha1.svg" alt="HAOne Logo" width="120" />
</p>

# HAOne

HAOne is a residence hall association management system designed to handle day-to-day operations, resident records, and financial accounting. It replaces manual spreadsheet tracking with a unified interface for hall administration, self-service resident utilities, and transparent financial reporting.

## Features

- Management of water fees, association fees, and miscellaneous financial transactions.
- Resident directory with room and bed assignments across academic terms.
- Automated PDF generation with QR code verification for payment receipts and clearance forms.
- Resident self-service portal for checking balances, submitting payment requests, and tracking clearance.
- Shared facility scheduling for laundry slot reservations and fridge storage tracking.
- Automated email dispatching via Gmail API for account statements and clearance notices.
- Announcement board and officer directory for hall updates.
- Community achievements and leaderboards.
- Dual-backend support for Google Sheets and Supabase.

## Tech Stack

- [Svelte](https://svelte.dev/)/[SvelteKit](https://kit.svelte.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn-svelte](https://www.shadcn-svelte.com/), [Bits UI](https://bits-ui.com/)
- [Google Sheets API](https://developers.google.com/workspace/sheets/api/guides/concepts) or [Supabase](https://supabase.com/)
- [Three.js](https://threejs.org/)
- [LayerChart](https://www.layerchart.com/)
- [Tiptap Rich Text Editor](https://tiptap.dev/product/editor)
- Cloudflare Workers (for cron job used by push notifications)
- [Cloudflare Pages](https://pages.cloudflare.com/) (for deployment)

## Getting Started

### Prerequisites

- [pnpm](https://pnpm.io/) (Mandatory)
- Google Cloud Project and OAuth clients for:
  - Admin with Sheets and Gmail APIs enabled
  - Resident for auth only
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
   Copy `.env.example` to `.env` and fill in the necessary information.

4. Start the development server:
   ```bash
   pnpm dev
   ```

#### Base structure for the `data-private` directory

You have to create the following directories and leave an empty file, e.g., `.gitignore`, in order to preserve them since `git` does not allow committing empty directories.

```
├── api
│   ├── controllers
│   └── services
│       ├── interfaces
│       ├── sheets
│       └── supabase
├── assets
├── branding.json
├── rooms.json
├── routes
│   ├── admin
│   ├── api
│   │   └── resident
│   └── resident
├── server
└── types
```
