#!/bin/bash

# LumoSnap API Testing Script

set -e

API_BASE="http://localhost:8787/api/v1"
SCALAR_KEY="b4582a0e41d4b49ff1e03018843c9eaf"

echo "🧪 Testing LumoSnap API Endpoints..."

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper function to make requests
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -e "\n${YELLOW}Testing: ${method} ${endpoint} - ${description}${NC}"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$API_BASE$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" \
            -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_BASE$endpoint")
    fi
    
    # Extract status code
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✅ Status: $http_code${NC}"
        echo "Response: $body" | jq '.' 2>/dev/null || echo "Response: $body"
    else
        echo -e "${RED}❌ Status: $http_code${NC}"
        echo "Response: $body" | jq '.' 2>/dev/null || echo "Response: $body"
    fi
}

# Test Public Endpoints (no auth required)
echo -e "\n${YELLOW}=== PUBLIC ENDPOINTS ===${NC}"

test_endpoint "GET" "/billing/plans" "" "Get available subscription plans"

# Test Album Creation (this will fail without auth, but we can see the structure)
test_endpoint "POST" "/albums" '{"title":"Test Album","eventDate":"2024-01-01"}' "Create album (will fail without auth)"

# Test Public Album Access (with a dummy token)
test_endpoint "GET" "/share/test-token" "" "Access album by share token (will fail - token doesn't exist)"

# Hello endpoint
test_endpoint "GET" "/hello" "" "Test hello endpoint"

# Health check
echo -e "\n${YELLOW}=== HEALTH CHECK ===${NC}"
test_endpoint "GET" "/" "" "Root endpoint"

echo -e "\n${YELLOW}=== API DOCUMENTATION ===${NC}"
echo "📚 API Documentation: http://localhost:8787/reference?key=$SCALAR_KEY"
echo "📚 OpenAPI Schema: http://localhost:8787/openapi"

echo -e "\n${GREEN}🎉 API Testing Complete!${NC}"
echo ""
echo "📝 Manual Testing Steps:"
echo "1. Start the dev server: npm run dev"
echo "2. Visit the API docs for interactive testing"
echo "3. Use the Better Auth endpoints to create a user:"
echo "   - POST /api/auth/sign-up with email/password"
echo "   - POST /api/auth/sign-in to get session"
echo "4. Use browser cookies to test authenticated endpoints"
echo ""
echo "🔧 For authenticated testing:"
echo "1. Sign up at: http://localhost:8787/api/auth/sign-up"
echo "2. Sign in at: http://localhost:8787/api/auth/sign-in"
echo "3. Then test endpoints like /api/v1/profile"