#!/bin/bash

# --- Configuration ---
# !!! IMPORTANT: Replace API_TOKEN with a fresh one obtained from logging in !!!
API_TOKEN="eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJjbTlvaHd0dGYwMDAwbXowemo4bjVvaDl4IiwiYmFkZ2VJZCI6Ik9GRklDRVIxMjMiLCJpYXQiOjE3NDUxNDAwNzIsImV4cCI6MTc0NTE0MzY3Mn0.IOfF4u1odnSDQYQ42XPv44he7luvXAy1pfU09uo2aBo"
# !!! Ensure this User ID exists in your database !!!
REPORTING_USER_ID="cm9ohwttf0000mz0zj8n5oh9x" # Or another valid user ID

API_ENDPOINT="http://localhost:3000/api/incidents"
NUM_INCIDENTS=50 # Increased number of incidents
SLEEP_INTERVAL=0.3 # Slightly faster interval

# --- More Realistic Data Arrays ---
locations=(
  "Brodipet 4th Lane, Guntur"
  "Arundelpet Main Road, Near Shankar Vilas, Guntur"
  "RTC Bus Stand Complex, Guntur"
  "Pattabhipuram Main Road, Guntur"
  "Lakshmipuram Circle, Near Chandramouli Theatre, Guntur"
  "Amaravati Road, Gorantla Area, Guntur"
  "Inner Ring Road, Near R&B Guest House, Gujjanagundla, Guntur"
  "AT Agraharam Market Area, Guntur"
  "Vidya Nagar, 1st Lane, Guntur"
  "Market Center, Old Guntur"
  "Collector Office Road, Guntur"
  "SVN Colony Park, Guntur"
  "Nallapadu Road, Guntur"
  "Stambalagaruvu Center, Guntur"
  "Koritepadu Main Road, Guntur"
  "Nagarampalem Police Station Road, Guntur"
  "Etukuru Road, Near Railway Track, Guntur"
  "Pedakakani Village Outskirts"
  "Prathipadu Main Road Junction"
  "Mangalagiri, Near Temple Area"
)

crime_types=(
  "Petty Theft (Shop)"
  "Vehicle Theft (Motorcycle)"
  "Public Nuisance (Loitering)"
  "Traffic Violation (Wrong Way Driving)"
  "Noise Complaint (Loud Music Late Night)"
  "Simple Assault (Argument Escalation)"
  "Pickpocketing (Bus Stand)"
  "Chain Snatching Attempt (Failed)"
  "Vandalism (Graffiti)"
  "Domestic Dispute (Verbal)"
  "Missing Person Inquiry (Child)"
  "Burglary (Residential - Attempted)"
  "Illegal Parking"
  "Public Intoxication"
  "Fraudulent Activity Report"
  "Harassment Complaint"
  "Road Rage Incident"
  "Suspicious Person Reported"
  "Property Damage (Minor)"
  "Lost Property Report"
)

# --- Script Logic ---
echo "Starting script to create ${NUM_INCIDENTS} realistic dummy incidents..."

num_locations=${#locations[@]}
num_crime_types=${#crime_types[@]}

for i in $(seq 1 $NUM_INCIDENTS)
do
  echo "-------------------------------------"
  echo "Attempting to create Incident #$i..."

  # Cycle through locations and crime types using modulo arithmetic
  location_index=$(( (i - 1) % num_locations ))
  crime_index=$(( (i - 1) % num_crime_types ))

  CURRENT_LOCATION="${locations[$location_index]}"
  CURRENT_CRIME_TYPE="${crime_types[$crime_index]}"

  # Generate a more randomized timestamp within the last 7 days (10080 minutes)
  # Using $RANDOM (0-32767), scale it appropriately. Max minutes = 10080.
  random_minutes=$(( RANDOM % 10080 ))
  OCCURRED_AT=$(date -v-${random_minutes}M -u +"%Y-%m-%dT%H:%M:%SZ") # Mac OS syntax
  # If on Linux, use: OCCURRED_AT=$(date -d "-$random_minutes minutes" -u +"%Y-%m-%dT%H:%M:%SZ")

  # Create a slightly more varied description
  case $(($i % 3)) in
    0) DESCRIPTION="Report filed regarding $CURRENT_CRIME_TYPE near $CURRENT_LOCATION. Incident #$i requires follow-up.";;
    1) DESCRIPTION="Details for incident #$i: $CURRENT_CRIME_TYPE occurred around specified time at $CURRENT_LOCATION. Witness statements pending.";;
    2) DESCRIPTION="$CURRENT_CRIME_TYPE reported by patrol unit at $CURRENT_LOCATION (Ref Incident #$i).";;
  esac
  STATUS="Open" # Start all as Open

  # Construct JSON payload using variables
  JSON_PAYLOAD=$(cat <<EOF
{
  "occurredAt": "$OCCURRED_AT",
  "location": "$CURRENT_LOCATION",
  "crimeType": "$CURRENT_CRIME_TYPE",
  "description": "$DESCRIPTION",
  "reportedById": "$REPORTING_USER_ID",
  "status": "$STATUS"
}
EOF
)

  # Make the API call using curl
  # echo "Payload: $JSON_PAYLOAD" # Uncomment to print payload for debugging
  curl -X POST "$API_ENDPOINT" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $API_TOKEN" \
    -d "$JSON_PAYLOAD" \
    --silent --show-error # Show errors but less verbose output

  # Check exit status of curl (0 means success)
  if [ $? -eq 0 ]; then
    echo ""
    echo "Incident #$i creation request sent successfully."
  else
    echo ""
    echo "Error sending request for Incident #$i. Check API response or token validity."
  fi

  # Wait before sending the next request
  sleep $SLEEP_INTERVAL

done

echo "-------------------------------------"
echo "Script finished creating ${NUM_INCIDENTS} incident requests."
echo "Please refresh your dashboard to see the new incidents and test pagination."

