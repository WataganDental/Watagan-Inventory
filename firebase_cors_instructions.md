# Firebase Storage CORS Configuration

Cross-Origin Resource Sharing (CORS) is a security feature that controls how web applications in one domain can request and interact with resources in another domain. When using Firebase Storage, if your web application is hosted on a different domain than your Firebase Storage bucket (which is usually the case, e.g., `your-app.firebaseapp.com` vs. `firebasestorage.googleapis.com`), you need to configure CORS rules for your storage bucket to allow requests from your web app's domain.

If CORS is not configured correctly, browsers will block requests (like fetching images) from your web app to Firebase Storage, often resulting in errors like "Network request failed" or specific CORS-related error messages in the browser console.

## How to Check and Configure CORS

You'll need to use the `gsutil` command-line tool, which is part of the Google Cloud SDK.

### 1. Install Google Cloud SDK (if you haven't already)

Follow the official instructions to install the Google Cloud SDK:
[https://cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install)

After installation, initialize `gcloud` if you haven't:
```bash
gcloud init
```
And make sure `gsutil` is updated:
```bash
gcloud components update
```

### 2. Identify Your Firebase Storage Bucket URL

Your Firebase Storage bucket URL typically follows this format: `gs://<YOUR_PROJECT_ID>.appspot.com`

You can find your project ID in the Firebase console settings.

### 3. Check Current CORS Configuration

To view the current CORS configuration for your bucket, run the following command, replacing `<YOUR_BUCKET_URL>` with your actual bucket URL:

```bash
gsutil cors get <YOUR_BUCKET_URL>
```
For example:
```bash
gsutil cors get gs://my-cool-project.appspot.com
```

This will either display the current CORS configuration (if one is set) or an error if no configuration exists.

### 4. Create a CORS Configuration File

Create a JSON file (e.g., `cors-config.json`) with your desired CORS rules. Here's an example configuration that allows GET requests from any origin (suitable for public read access to images) and also specifically allows requests from your Firebase Hosting domains and common local development origins:

```json
[
  {
    "origin": ["*"],
    "method": ["GET"],
    "maxAgeSeconds": 3600
  },
  {
    "origin": [
      "http://localhost:5000",
      "http://localhost:5001",
      "http://127.0.0.1:5000",
      "http://127.0.0.1:5001",
      "https://your-app-name.firebaseapp.com",
      "https://your-app-name.web.app"
    ],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "responseHeader": [
      "Content-Type",
      "Content-Length",
      "Access-Control-Allow-Origin"
    ],
    "maxAgeSeconds": 3600
  }
]
```

**Important:**
- Replace `"https://your-app-name.firebaseapp.com"` and `"https://your-app-name.web.app"` with your actual Firebase app domains.
- The first rule `{"origin": ["*"], "method": ["GET"]}` is broad for GET requests. If you need stricter control, remove this and rely on the more specific origins in the second rule.
- `maxAgeSeconds` defines how long the browser can cache the preflight OPTIONS request.

### 5. Apply the CORS Configuration

To apply the configuration from your JSON file to your bucket, run:

```bash
gsutil cors set cors-config.json <YOUR_BUCKET_URL>
```
For example:
```bash
gsutil cors set cors-config.json gs://my-cool-project.appspot.com
```

### 6. Verify the Changes

After applying, you can re-run the `get` command to confirm the new settings:
```bash
gsutil cors get <YOUR_BUCKET_URL>
```

## Example `cors.json` (as provided in the repository: `cors-example.json`)

This repository includes an example file named `cors-example.json`. You can adapt this file for your needs. Remember to replace placeholder domains with your actual application domains.

```json
[
  {
    "origin": ["*"],
    "method": ["GET"],
    "maxAgeSeconds": 3600
  },
  {
    "origin": [
      "http://localhost:5000",
      "http://localhost:5001",
      "http://127.0.0.1:5000",
      "http://127.0.0.1:5001",
      "https://YOUR_PROJECT_ID.firebaseapp.com",
      "https://YOUR_PROJECT_ID.web.app"
    ],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type", "Access-Control-Allow-Origin"],
    "maxAgeSeconds": 3600
  }
]
```
**Note:** Modify `YOUR_PROJECT_ID` in `cors-example.json` before using it.

By correctly configuring CORS, you ensure that your web application can reliably access images and other resources stored in your Firebase Storage bucket.
