"""
Cloudflare R2 file storage client (S3-compatible).

All uploaded files go to R2 instead of being held in memory.
The backend fetches them back from R2 when analysis is needed.

Bucket layout:
  uploads/{org_id}/{dataset_id}/{filename}

Usage:
    from storage import storage
    key  = await storage.upload(org_id, dataset_id, filename, file_bytes)
    data = await storage.download(key)
    url  = storage.presign(key, expires=3600)
    await storage.delete(key)
"""
import io
import os
import shutil
import tempfile
import uuid
from typing import Optional

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from loguru import logger

# ── Config ─────────────────────────────────────────────────────────────────────

R2_ACCOUNT_ID      = os.getenv("R2_ACCOUNT_ID", "")
R2_ACCESS_KEY_ID   = os.getenv("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "")
R2_BUCKET_NAME     = os.getenv("R2_BUCKET_NAME", "sushi-uploads")
R2_PUBLIC_URL      = os.getenv("R2_PUBLIC_URL", "")  # optional CDN/public URL
LOCAL_STORAGE_DIR  = os.getenv(
    "LOCAL_STORAGE_DIR",
    os.path.join(tempfile.gettempdir(), "sushi", "storage"),
)

# Cloudflare R2 endpoint uses the account ID
R2_ENDPOINT_URL = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com" if R2_ACCOUNT_ID else ""

# Max upload size enforced before touching R2 (100 MB)
MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024


class R2Storage:
    """Thin wrapper around the boto3 S3 client pointed at Cloudflare R2."""

    def __init__(self) -> None:
        self._client = None

    @property
    def client(self):
        """Lazy-init the boto3 client so the app starts even without R2 creds."""
        if self._client is None:
            if not R2_ACCOUNT_ID:
                raise RuntimeError("R2 credentials unavailable")
            self._client = boto3.client(
                "s3",
                endpoint_url=R2_ENDPOINT_URL,
                aws_access_key_id=R2_ACCESS_KEY_ID,
                aws_secret_access_key=R2_SECRET_ACCESS_KEY,
                config=Config(signature_version="s3v4"),
                region_name="auto",
            )
        return self._client

    @property
    def use_local_storage(self) -> bool:
        return not R2_ACCOUNT_ID

    def _local_path(self, key: str) -> str:
        safe_key = key.replace("/", os.sep)
        return os.path.join(LOCAL_STORAGE_DIR, safe_key)

    # ── Upload ─────────────────────────────────────────────────────────────────

    def upload(
        self,
        org_id: str,
        dataset_id: str,
        filename: str,
        data: bytes,
        content_type: Optional[str] = None,
    ) -> str:
        """
        Upload raw bytes to R2. Returns the object key.

        Key format: uploads/{org_id}/{dataset_id}/{filename}
        """
        if len(data) > MAX_FILE_SIZE_BYTES:
            raise ValueError(f"File exceeds {MAX_FILE_SIZE_BYTES // (1024*1024)} MB limit")

        key = f"uploads/{org_id}/{dataset_id}/{filename}"
        extra_args: dict = {}
        if content_type:
            extra_args["ContentType"] = content_type

        if self.use_local_storage:
            path = self._local_path(key)
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "wb") as f:
                f.write(data)
            logger.info(f"Stored locally: {path} ({len(data):,} bytes)")
            return key

        try:
            self.client.put_object(
                Bucket=R2_BUCKET_NAME,
                Key=key,
                Body=data,
                **extra_args,
            )
            logger.info(f"Uploaded to R2: {key} ({len(data):,} bytes)")
            return key
        except ClientError as e:
            logger.error(f"R2 upload failed for {key}: {e}")
            raise

    # ── Download ───────────────────────────────────────────────────────────────

    def download(self, key: str) -> bytes:
        """Download object from R2 by key, return raw bytes."""
        if self.use_local_storage:
            path = self._local_path(key)
            with open(path, "rb") as f:
                data = f.read()
            logger.info(f"Loaded local object: {path} ({len(data):,} bytes)")
            return data
        try:
            response = self.client.get_object(Bucket=R2_BUCKET_NAME, Key=key)
            data = response["Body"].read()
            logger.info(f"Downloaded from R2: {key} ({len(data):,} bytes)")
            return data
        except ClientError as e:
            logger.error(f"R2 download failed for {key}: {e}")
            raise

    def download_stream(self, key: str) -> io.BytesIO:
        """Download and return as a seekable BytesIO stream (pandas-friendly)."""
        return io.BytesIO(self.download(key))

    # ── Delete ─────────────────────────────────────────────────────────────────

    def delete(self, key: str) -> None:
        """Delete an object from R2."""
        if self.use_local_storage:
            path = self._local_path(key)
            if os.path.exists(path):
                os.remove(path)
            logger.info(f"Deleted local object: {path}")
            return
        try:
            self.client.delete_object(Bucket=R2_BUCKET_NAME, Key=key)
            logger.info(f"Deleted from R2: {key}")
        except ClientError as e:
            logger.error(f"R2 delete failed for {key}: {e}")
            raise

    def delete_prefix(self, prefix: str) -> int:
        """Delete all objects under a prefix (e.g. all files for a dataset)."""
        deleted = 0
        if self.use_local_storage:
            path = self._local_path(prefix)
            if os.path.isdir(path):
                deleted = sum(len(files) for _, _, files in os.walk(path))
                shutil.rmtree(path, ignore_errors=True)
            elif os.path.exists(path):
                os.remove(path)
                deleted = 1
            logger.info(f"Deleted {deleted} local objects under prefix: {path}")
            return deleted
        try:
            paginator = self.client.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=R2_BUCKET_NAME, Prefix=prefix):
                objects = [{"Key": obj["Key"]} for obj in page.get("Contents", [])]
                if objects:
                    self.client.delete_objects(
                        Bucket=R2_BUCKET_NAME,
                        Delete={"Objects": objects},
                    )
                    deleted += len(objects)
        except ClientError as e:
            logger.error(f"R2 delete_prefix failed for {prefix}: {e}")
            raise
        logger.info(f"Deleted {deleted} objects under prefix: {prefix}")
        return deleted

    # ── Pre-signed URLs ────────────────────────────────────────────────────────

    def presign(self, key: str, expires: int = 3600) -> str:
        """
        Generate a pre-signed URL for direct browser download (no auth needed).
        expires: seconds until the URL expires (default 1 hour).
        """
        if self.use_local_storage:
            return self._local_path(key)
        try:
            url = self.client.generate_presigned_url(
                "get_object",
                Params={"Bucket": R2_BUCKET_NAME, "Key": key},
                ExpiresIn=expires,
            )
            return url
        except ClientError as e:
            logger.error(f"R2 presign failed for {key}: {e}")
            raise

    def presign_upload(self, key: str, content_type: str, expires: int = 900) -> dict:
        """
        Generate a pre-signed POST URL so the frontend can upload directly to R2
        without routing through the API server (saves bandwidth + latency).
        Returns: {url, fields} dict for use with <form> or fetch POST.
        """
        if self.use_local_storage:
            return {"url": self._local_path(key), "fields": {"Content-Type": content_type}}
        try:
            result = self.client.generate_presigned_post(
                Bucket=R2_BUCKET_NAME,
                Key=key,
                Fields={"Content-Type": content_type},
                Conditions=[
                    {"Content-Type": content_type},
                    ["content-length-range", 1, MAX_FILE_SIZE_BYTES],
                ],
                ExpiresIn=expires,
            )
            return result
        except ClientError as e:
            logger.error(f"R2 presign_upload failed for {key}: {e}")
            raise

    # ── Helpers ────────────────────────────────────────────────────────────────

    @staticmethod
    def make_dataset_key(org_id: str, filename: str) -> str:
        """Generate a unique R2 key for a new dataset upload."""
        dataset_id = str(uuid.uuid4())
        return f"uploads/{org_id}/{dataset_id}/{filename}", dataset_id

    def public_url(self, key: str) -> str:
        """Return the CDN public URL for a key (only works if bucket is public)."""
        if R2_PUBLIC_URL:
            return f"{R2_PUBLIC_URL.rstrip('/')}/{key}"
        return self.presign(key)


# ── Singleton ─────────────────────────────────────────────────────────────────
storage = R2Storage()
