#!/bin/bash

# LumoSnap Advanced API Testing Script (with Authentication)

set -e

API_BASE="http://localhost:8787/api/v1"
AUTH_BASE="http://localhost:8787/api/auth"
SCALAR_KEY="b4582a0e41d4b49ff1e03018843c9eaf"

# Test user credentials
TEST_EMAIL="test@lumosnap.com"
TEST_PASSWORD="TestPassword123!"
TEST_NAME="Test Photographer"

echo "🧪 Advanced LumoSnap API Testing (with Authentication)..."

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    local use_cookies=${5:-false}
    
    echo -e "\n${YELLOW}Testing: ${method} ${endpoint} - ${description}${NC}"
    
    local curl_cmd="curl -s -w '\n%{http_code}'"
    
    if [ "$use_cookies" = "true" ]; then
        curl_cmd="$curl_cmd -c cookies.txt -b cookies.txt"
    fi
    
    if [ "$method" != "GET" ]; then
        curl_cmd="$curl_cmd -X '$method' -H 'Content-Type: application/json'"
        if [ -n "$data" ]; then
            curl_cmd="$curl_cmd -d '$data'"
        fi
    fi
    
    curl_cmd="$curl_cmd '$endpoint'"
    
    response=$(eval $curl_cmd)
    
    # Extract status code
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✅ Status: $http_code${NC}"
        echo "Response: $body" | jq '.' 2>/dev/null || echo "Response: $body"
        return 0
    else
        echo -e "${RED}❌ Status: $http_code${NC}"
        echo "Response: $body" | jq '.' 2>/dev/null || echo "Response: $body"
        return 1
    fi
}

# Clean up function
cleanup() {
    rm -f cookies.txt
    echo -e "\n${YELLOW}🧹 Cleaned up temporary files${NC}"
}

trap cleanup EXIT

# Start testing
echo -e "\n${BLUE}=== 1. USER AUTHENTICATION FLOW ===${NC}"

# Clean up any existing cookies
rm -f cookies.txt

# Step 1: Sign up
make_request "POST" "$AUTH_BASE/sign-up" "{
  \"email\": \"$TEST_EMAIL\",
  \"password\": \"$TEST_PASSWORD\",
  \"name\": \"$TEST_NAME\"
}" "Sign up new user" || echo "User might already exist"

# Step 2: Sign in
echo -e "\n${BLUE}=== 2. SIGN IN (Get Session) ===${NC}"
make_request "POST" "$AUTH_BASE/sign-in" "{
  \"email\": \"$TEST_EMAIL\",
  \"password\": \"$TEST_PASSWORD\"
}" "Sign in user" true

if [ $? -eq 0 ]; then
    echo -e "${GREEN}🎉 Successfully signed in! Session cookie saved.${NC}"
else
    echo -e "${RED}❌ Failed to sign in. Check credentials or server status.${NC}"
    exit 1
fi

# Step 3: Get current session
make_request "GET" "$AUTH_BASE/get-session" "" "Get current session" true

echo -e "\n${BLUE}=== 3. PROFILE MANAGEMENT ===${NC}"

# Get profile
make_request "GET" "$API_BASE/profile" "" "Get user profile" true

# Update profile
make_request "PUT" "$API_BASE/profile" "{
  \"businessName\": \"LumoSnap Photography Studio\",
  \"phone\": \"+1-555-0123\"
}" "Update user profile" true

# Get updated profile
make_request "GET" "$API_BASE/profile" "" "Get updated profile" true

echo -e "\n${BLUE}=== 4. BILLING & SUBSCRIPTIONS ===${NC}"

# Get plans (public endpoint)
make_request "GET" "$API_BASE/billing/plans" "" "Get subscription plans"

# Get subscription
make_request "GET" "$API_BASE/billing/subscription" "" "Get current subscription" true

# Create subscription (Pro plan)
make_request "POST" "$API_BASE/billing/subscription" "{
  \"planId\": 2
}" "Create Pro subscription" true

echo -e "\n${BLUE}=== 5. ALBUM MANAGEMENT ===${NC}"

# Create album
make_request "POST" "$API_BASE/albums" "{
  \"title\": \"Test Wedding Album\",
  \"eventDate\": \"2024-06-15\",
  \"isPublic\": true
}" "Create new album" true

# List albums
make_request "GET" "$API_BASE/albums" "" "List all albums" true

echo -e "\n${BLUE}=== 6. UPLOAD URL GENERATION ===${NC}"

# Test upload URL generation (with dummy album ID)
ALBUM_ID="test-album-id"
make_request "POST" "$API_BASE/albums/$ALBUM_ID/upload" "{
  \"files\": [
    {\"filename\": \"photo1.jpg\"},
    {\"filename\": \"photo2.jpg\"},
    {\"filename\": \"photo3.jpg\"}
  ]
}" "Generate upload URLs" true

echo -e "\n${BLUE}=== 7. BILLING ADDRESSES ===${NC}"

# Create billing address
make_request "POST" "$API_BASE/profile/billing-addresses" "{
  \"street\": \"123 Photography St\",
  \"city\": \"San Francisco\",
  \"state\": \"CA\",
  \"zip\": \"94102\",
  \"country\": \"USA\",
  \"isDefault\": true
}" "Create billing address" true

# Get billing addresses
make_request "GET" "$API_BASE/profile/billing-addresses" "" "Get billing addresses" true

echo -e "\n${BLUE}=== 8. PUBLIC ACCESS TESTS ===${NC}"

# Test public album access (will fail without valid token)
make_request "GET" "$API_BASE/share/invalid-token" "" "Test album access with invalid token"

echo -e "\n${GREEN}=== 🎉 TESTING COMPLETE! ===${NC}"

echo -e "\n${YELLOW}📚 Manual Testing Next Steps:${NC}"
echo "1. Start the dev server: npm run dev"
echo "2. Visit: http://localhost:8787/reference?key=$SCALAR_KEY"
echo "3. Use the interactive API docs for more testing"
echo "4. Test file uploads using the generated upload URLs"
echo "5. Test complete photo sharing workflow"
echo ""
echo -e "${YELLOW}🔧 For testing file uploads:${NC}"
echo "1. Create an album"
echo "2. Generate upload URLs"
echo "3. Upload images directly to Backblaze using the URLs"
echo "4. Confirm upload with metadata"
echo "5. Access album via share link"
echo "6. Add favorites as a client"
echo ""
echo -e "${YELLOW}🐛 Debugging:${NC}"
echo "- Check server logs for detailed error messages"
echo "- Use browser dev tools to inspect cookies and requests"
echo "- Use 'jq' command for pretty JSON responses (installed with most systems)"
echo "- Database can be inspected with any PostgreSQL client at localhost:5432"

# Show cookie contents for debugging
if [ -f "cookies.txt" ]; then
    echo -e "\n${BLUE}🍪 Session Cookie Contents:${NC}"
    cat cookies.txt
fi