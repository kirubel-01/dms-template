# DentalOS Resale & Deployment Guide

This guide explains how to resell and deploy the DentalOS application for a new client. The process involves duplicating the code, setting up a fresh database, and configuring the environment.

## Prerequisites

-   Use **VS Code** or another code editor.
-   Have **Node.js** installed.
-   have a **Supabase** account (free or pro).

## Step 1: Duplicate the Codebase

1.  Copy the entire `dentalos` folder and rename it to your new client's project name (e.g., `client-dental-clinic`).
2.  Open this new folder in your code editor.

## Step 2: Create a New Supabase Project

1.  Go to [database.new](https://database.new) and create a new project.
2.  Wait for the database to be provisioned.
3.  Go to **Project Settings > API**.
4.  Copy the **Project URL** and **anon public key**.

## Step 3: Configure Environment Variables

1.  In the project root, rename `.env.example` to `.env`.
2.  Open `.env` and paste your Supabase credentials:

    ```env
    VITE_SUPABASE_URL=https://your-new-project.supabase.co
    VITE_SUPABASE_ANON_KEY=your-new-anon-key
    ```

## Step 4: Run the Database Setup Script

This is the most important step. It sets up all tables, security policies, and the admin user automatically.

1.  Open the `setup.sql` file located in the root folder of the project.
2.  Copy **all** the content of `setup.sql`.
3.  Go to your Supabase Dashboard > **SQL Editor**.
4.  Paste the code into the SQL Editor.
5.  Click **Run**.

**What this does:**
-   Creates all necessary tables (Patients, Treatments, Appointments, etc.).
-   Sets up secure Row Level Security (RLS) policies.
-   Creates a default admin user.

### Default Login Credentials
After running the script, you can log in immediately with:
-   **Email:** `admin@clinic.com`
-   **Password:** `admin123`

## Step 5: Run the Application Locally

1.  Open a terminal in the project folder.
2.  Install dependencies (if cleaning node_modules) or just run:
    ```bash
    npm run dev
    ```
3.  Open the local URL (usually `http://localhost:5173`) to verify everything works.

## Step 6: Deploy to Production

When you are ready to give the link to the client:

1.  Run `npm run build` to create a production build.
2.  Deploy the `dist` folder to a hosting provider like **Netlify**, **Vercel**, or **Firebase Hosting**.

### Example: Netlify Drop
1.  Run `npm run build`.
2.  Drag and drop the `dist` folder to [Netlify Drop](https://app.netlify.com/drop).
3.  Go to **Site Settings > Environment Variables** in Netlify and add your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` there as well.

---

**You are now ready to sell!** Just repeat this process for every new client. Each client gets their own secure database and separate deployment.
