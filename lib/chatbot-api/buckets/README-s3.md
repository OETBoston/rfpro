# S3 Buckets Overview

The S3 buckets are an integral part of the application, supporting various functionalities such as data storage for Kendra sources and feedback downloads. These buckets are defined in the `S3BucketStack` class and are managed through AWS CDK.

## Buckets Defined

### Kendra Sources Bucket (`kendraBucket`)
This bucket is used to store the source files required by Amazon Kendra for indexing and search functionalities.

**Key Features:**
- **Versioning**: Enabled to maintain historical versions of objects.
- **Removal Policy**: `DESTROY` policy ensures the bucket and its objects are deleted during stack teardown.
- **Public Access**: Configured with relaxed public access rules but still includes block settings.
- **CORS Configuration**:
  - Allowed Methods: GET, POST, PUT, DELETE.
  - Allowed Origins: `*` (any origin).
  - Allowed Headers: `*` (all headers).
- **Policy Statement**:
  - Allows `GetObject` and `PutObject` actions for all principals on all objects within the bucket.
