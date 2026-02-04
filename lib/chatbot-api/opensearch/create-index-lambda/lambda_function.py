import os
import boto3
from opensearchpy import OpenSearch, RequestsHttpConnection, AWSV4SignerAuth
from botocore.awsrequest import AWSRequest
import json
import time

def lambda_handler(event, context):
    print(f"Event received: {json.dumps(event)}")
    
    # Handle CloudFormation custom resource events
    request_type = event.get('RequestType', 'Create')
    
    # Only create index on Create and Update, skip on Delete
    if request_type == 'Delete':
        print("Delete request received - skipping index deletion")
        return {
            'Status': 'SUCCESS',
            'PhysicalResourceId': event.get('PhysicalResourceId', 'opensearch-index'),
            'StackId': event['StackId'],
            'RequestId': event['RequestId'],
            'LogicalResourceId': event['LogicalResourceId']
        }
    
    # 1. Defining the request body for the index and field creation
    host = os.environ["COLLECTION_ENDPOINT"]
    print(f"Collection Endpoint: " + host)
    index_name = os.environ["INDEX_NAME"]
    print(f"Index name: " + index_name)    
        
    payload = {
      "settings": {
        "index": {
          "knn": True,
          "knn.algo_param.ef_search": 512
        }
      },
      "mappings": { #how do we store, 
        "properties": {
          "vector_field": {
            "type": "knn_vector", #we are going to put 
            "dimension": int(os.environ["EMBEDDING_DIM"]),
            "method": {
              "name": "hnsw",
              "space_type": "innerproduct",
              "engine": "faiss",
              "parameters": {
                "ef_construction": 512,
                "m": 16
              }
            }
          },
          "metadata_field" : {"type": "text", "index": False},
          "text_field" : {"type": "text"},
        }
      }
    }
    
    # 2. Obtaining AWS credentials and signing the AWS API request 
    region = os.environ["REGION"]
    service = 'aoss'
    credentials = boto3.Session().get_credentials()    
    payload_json = json.dumps(payload)
    auth = AWSV4SignerAuth(credentials, region, service)

    client = OpenSearch(
            hosts=[{"host": host, "port": 443}],
            http_auth=auth,
            use_ssl=True,
            verify_certs=True,
            connection_class=RequestsHttpConnection,
            pool_maxsize=20,
        )
    
    try:
      # Check if index already exists (use keyword argument)
      if client.indices.exists(index=index_name):
          print(f"Index {index_name} already exists - skipping creation")
          return {
              'Status': 'SUCCESS',
              'PhysicalResourceId': f'{index_name}-resource',
              'Data': {
                  'IndexName': index_name,
                  'Message': 'Index already exists'
              }
          }
      
      # Create the index (use keyword arguments)
      response = client.indices.create(index=index_name, body=payload_json)
      print(f"Index creation response: {response}")
      
      # Wait for index to be fully created and propagated
      print("Waiting 60 seconds for index to be fully available...")
      time.sleep(60)
      
      # Verify index exists (use keyword argument)
      if client.indices.exists(index=index_name):
          print(f"Index {index_name} verified to exist")
          return {
              'Status': 'SUCCESS',
              'PhysicalResourceId': f'{index_name}-resource',
              'Data': {
                  'IndexName': index_name,
                  'Message': 'Index created successfully'
              }
          }
      else:
          raise Exception(f"Index {index_name} was not found after creation")
          
    except Exception as e:
       print(f"Error during index creation: {str(e)}")
       print(f"Error type: {type(e).__name__}")
       
       # If it's a resource already exists error, that's actually ok
       if "resource_already_exists" in str(e).lower():
           print("Index already exists - treating as success")
           return {
               'Status': 'SUCCESS',
               'PhysicalResourceId': f'{index_name}-resource',
               'Data': {
                   'IndexName': index_name,
                   'Message': 'Index already exists'
               }
           }
       
       # For other errors, fail the custom resource
       raise
    