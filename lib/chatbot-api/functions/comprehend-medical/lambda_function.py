import json
import boto3
from enum import Enum

class State(Enum):
    AL = "Alabama"
    AK = "Alaska" 
    AZ = "Arizona"
    AR = "Arkansas"
    CA = "California"
    CO = "Colorado"
    CT = "Connecticut"
    DE = "Delaware"
    FL = "Florida"
    GA = "Georgia"
    HI = "Hawaii"
    ID = "Idaho"
    IL = "Illinois"
    IN = "Indiana"
    IA = "Iowa"
    KS = "Kansas"
    KY = "Kentucky"
    LA = "Louisiana"
    ME = "Maine"
    MD = "Maryland"
    MA = "Massachusetts"
    MI = "Michigan"
    MN = "Minnesota"
    MS = "Mississippi"
    MO = "Missouri"
    MT = "Montana"
    NE = "Nebraska"
    NV = "Nevada"
    NH = "New Hampshire"
    NJ = "New Jersey"
    NM = "New Mexico"
    NY = "New York"
    NC = "North Carolina"
    ND = "North Dakota"
    OH = "Ohio"
    OK = "Oklahoma"
    OR = "Oregon"
    PA = "Pennsylvania"
    RI = "Rhode Island"
    SC = "South Carolina"
    SD = "South Dakota"
    TN = "Tennessee"
    TX = "Texas"
    UT = "Utah"
    VT = "Vermont"
    VA = "Virginia"
    WA = "Washington"
    WV = "West Virginia"
    WI = "Wisconsin"
    WY = "Wyoming"

def contains_state(text):
    for state in State:
        if state.name in text or state.value in text:
            return True
    return False
    
    
def find_state(address):
    for state in State:
        # Replace both the full state name and the abbreviation if present
        if state.name in address:
            address = address.replace(state.name, "")
        if state.value in address:
            address = address.replace(state.value, "")
    return address.strip()  # Strip to clean up any leading/trailing whitespace

    

client = boto3.client(service_name='comprehend', region_name='us-east-1')

def lambda_handler(event, context):
    try:
        if event.get('body'):
            body = json.loads(event['body'])
        else:
            body = {}

        content = body.get('content', '')
        if not content:
            return {'headers': {
                'Access-Control-Allow-Origin': '*'
                },'statusCode': 400, 'body': json.dumps("Error: No content provided")}


        results = client.detect_pii_entities(Text=content, LanguageCode='en')
        detectedPII = results['Entities']


    except Exception as e:
        print(e)
        return {'headers': {
                'Access-Control-Allow-Origin': '*'
                },
            'statusCode': 500,
            'body': json.dumps({"Error": "Something went wrong!"})
        }

    return {'headers': {
                'Access-Control-Allow-Origin': '*'
                },
        'statusCode': 200,
        'body': json.dumps({"redacted_text": redact_text(content, detectedPII)})
    }

def redact_text(prompt, entities):
    
    confidence_thresholds = {
        "NAME": 0.01,     
        "ADDRESS": 0.01,   
        "AGE": 0.01,       
        "OTHER": 0.01     
    }
    
    # Expanded whitelists for exceptions
    approved_names = [
        "robin","MBY", "chaffee", "masshealth", "chafee",
        # Add more approved names here as needed
        "medicare", "medicaid", "cms", "hhs", "eohhs",
        "onbase", "epic", "five9"  # Common system/platform names
    ]
    
    approved_addresses = [
        "masshealth",
        # Add more approved addresses/locations here as needed
        "boston", "massachusetts", "worcester", "springfield",
        "cambridge", "lowell", "brockton", "new bedford",
        "lynn", "quincy", "newton", "somerville"  # Common MA cities
    ]
    
    # Entity types to completely skip (never redact)
    skip_entity_types = [
        "PROFESSION", "URL",
        # Add more entity types to skip here as needed
        # "PHONE_NUMBER",  # Uncomment if you want to allow phone numbers
        # "EMAIL",         # Uncomment if you want to allow email addresses
    ]
    
    # Keywords that should never be redacted regardless of PII detection
    never_redact_keywords = [
        "masshealth", "medicare", "medicaid", "onbase", "epic", "five9",
        "massachusetts", "boston", "eohhs", "cms", "hhs","robin","MBY"
        # Add more system/platform/organization names here
    ]
    
    redacted_text = prompt
    offset_shift = 0
    
    for entity in entities:
        
        replacement = ''
        adjusted_begin = entity['BeginOffset'] + offset_shift
        adjusted_end = entity['EndOffset'] + offset_shift
        pii_text = redacted_text[adjusted_begin:adjusted_end]
        
        confidence = entity.get("Score", 0)  # Extract confidence score, default to 0 if missing
        entity_type = entity["Type"]
        print(entity_type, round(confidence, 2))

        # Get the appropriate threshold for the entity type, default to "OTHER" if not specified
        threshold = confidence_thresholds.get(entity_type, confidence_thresholds["OTHER"])
    
        # Only redact if the confidence is greater than the threshold
        if confidence < threshold:
            continue  # Skip this entity, do not redact
        
        # Check if the detected text contains any never-redact keywords
        if any(keyword.lower() in pii_text.lower() for keyword in never_redact_keywords):
            print(f"Skipping redaction for '{pii_text}' - contains never-redact keyword")
            continue
    
        if entity["Type"] in skip_entity_types:
            continue  # Skip redaction for specified entity types

        elif entity_type == "DATE_TIME":
            # Check if the date is year-only by confirming it has exactly four digits
            if len(pii_text) == 4 and pii_text.isdigit():
                continue  # Skip redaction for year-only dates
            else:
                replacement = "[DATE_TIME]"
                redacted_text = redacted_text.replace(pii_text, replacement)

        elif entity["Type"] == "AGE":
            age = float([int(word) for word in pii_text.split() if word.isdigit()][0])
            if age > 89:
                replacement = "[AGE OVER 89]"
                redacted_text = redacted_text.replace(pii_text, replacement)
                
        elif entity["Type"] == "ADDRESS":
            print(f"Found address in the message{entity}")
            address = entity.get('Text', '4th Street').lower() # Default to 4th Street if no address
            
            if contains_state(pii_text):
                print(f"contains state was true for {pii_text}")
                address_without_state = find_state(pii_text)
                print(f"address_without_state: {address_without_state}")
                if address_without_state != "":
                    replacement = "[ADDRESS]"
                    redacted_text = redacted_text.replace(address_without_state, replacement)
                    print(f"Redacted Text after replace: {redacted_text}")
                else: 
                    print(f"Contains only state")
                
            elif address in approved_addresses:
                replacement = address
                redacted_text = redacted_text.replace(pii_text, replacement)
                
            else:
                replacement = "[ADDRESS]"
                redacted_text = redacted_text.replace(pii_text, replacement)
                
                
        elif entity["Type"] == "NAME":
            print(f"Found name in the message{entity}")
            
            # check if the name is an approved name
            name = entity.get('Text', 'Jake').lower() # Default to Jake if no name 
            if name in approved_names:
                replacement = name
                redacted_text = redacted_text.replace(pii_text, replacement)
            else:
                replacement = "[NAME]"
                redacted_text = redacted_text.replace(pii_text, replacement)
                    
        else:
            entity_text = entity.get('Text', '')
            replacement = "[" + entity["Type"] + "]"
            
            redacted_text = redacted_text.replace(pii_text, replacement)
            
            
        # Calculate the shift in length caused by this replacement
        length_diff = len(replacement) - len(pii_text)
        # Update the offset shift for subsequent replacements
        offset_shift += length_diff
        
        
    return redacted_text
