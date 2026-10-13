# Deploying the Python engine on Vercel

The app uses Next.js for the UI and a Vercel Python Function for image processing. It does not require a separate backend server. Local development still uses the `.venv` worker pool.

## One-time Vercel setup

1. In the Vercel project connected to `Nobody082/Destroyer`, open **Storage** and create a **private** Blob store.
2. Connect that store to the project and make sure `BLOB_READ_WRITE_TOKEN` is available in Production and Preview.
3. Deploy the latest `main` commit. The Python runtime uses Python 3.12 from `.python-version` and installs the packages in `requirements.txt`.

The source upload uses a scoped client upload token and is limited to image formats and 25 MB. Generated images stay in private Blob storage and are served through `/api/result`. Blob usage may incur charges depending on storage and transfer volume.

Vercel Function duration and memory limits still apply. The Node generation route and Python worker are configured for up to 300 seconds; a generation with many slow effects may exceed the account's available maximum.

## Local development

`npm run dev` continues to use `.venv` and the existing local worker pool. The Vercel Blob route reports Blob as optional outside Vercel.

