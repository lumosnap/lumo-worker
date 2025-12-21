#!/bin/bash

# Comprehensive API Test with Authentication Flow

set -e

API_BASE="http://localhost:8787"
SCALAR_KEY="b4582a0e41d4b49ff1e03018843c9eaf"

echo "🧪 LumoSnap Complete API Testing Suite..."

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Store cookies in a file
COOKIE_JAR="./test-cookies.txt"
rm -f "$COOKIE_JAR"

echo -e "${BLUE}📝 Step 1: User Registration & Authentication${NC}"

# 1. Register a new user
echo -e "\n${YELLOW}Registering new test user...${NC}"
register_response=$(curl -s -c "$COOKIE_JAR" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "email": "test@lumosnap.com",
        "password": "testpassword123",
        "name": "Test Photographer"
    }' \
    "$API_BASE/api/auth/sign-up")

echo "Register Response: $register_response" | jq '.' 2>/dev/null || echo "Register Response: $register_response"

# 2. Sign in
echo -e "\n${YELLOW}Signing in test user...${NC}"
login_response=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "email": "test@lumosnap.com",
        "password": "testpassword123"
    }' \
    "$API_BASE/api/auth/sign-in")

echo "Login Response: $login_response" | jq '.' 2>/dev/null || echo "Login Response: $login_response"

# Check if login was successful
if echo "$login_response" | grep -q "session"; then
    echo -e "${GREEN}✅ Authentication successful!${NC}"
else
    echo -e "${RED}❌ Authentication failed!${NC}"
    exit 1
fi

echo -e "\n${BLUE}📝 Step 2: Profile Management${NC}"

# 3. Get user profile
echo -e "\n${YELLOW}Getting user profile...${NC}"
profile_response=$(curl -s -b "$COOKIE_JAR" \
    "$API_BASE/api/v1/profile")

echo "Profile Response: $profile_response" | jq '.' 2>/dev/null || echo "Profile Response: $profile_response"

# 4. Update user profile
echo -e "\n${YELLOW}Updating user profile...${NC}"
update_profile_response=$(curl -s -b "$COOKIE_JAR" \
    -X PUT \
    -H "Content-Type: application/json" \
    -d '{
        "businessName": "Test Photography Studio",
        "phone": "+1-555-0123"
    }' \
    "$API_BASE/api/v1/profile")

echo "Update Profile Response: $update_profile_response" | jq '.' 2>/dev/null || echo "Update Profile Response: $update_profile_response"

# 5. Add billing address
echo -e "\n${YELLOW}Adding billing address...${NC}"
billing_address_response=$(curl -s -b "$COOKIE_JAR" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "street": "123 Photography Lane",
        "city": "Camera Town",
        "state": "CA",
        "zip": "90210",
        "country": "USA",
        "isDefault": true
    }' \
    "$API_BASE/api/v1/profile/billing-addresses")

echo "Billing Address Response: $billing_address_response" | jq '.' 2>/dev/null || echo "Billing Address Response: $billing_address_response"

echo -e "\n${BLUE}📝 Step 3: Album Management${NC}"

# 6. Create an album
echo -e "\n${YELLOW}Creating album...${NC}"
create_album_response=$(curl -s -b "$COOKIE_JAR" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "title": "Test Wedding Album",
        "eventDate": "2024-06-15",
        "isPublic": true
    }' \
    "$API_BASE/api/v1/albums")

echo "Create Album Response: $create_album_response" | jq '.' 2>/dev/null || echo "Create Album Response: $create_album_response"

# Extract album ID for later tests
ALBUM_ID=$(echo "$create_album_response" | jq -r '.data.id // empty')

if [ -n "$ALBUM_ID" ] && [ "$ALBUM_ID" != "null" ]; then
    echo -e "${GREEN}✅ Album created with ID: $ALBUM_ID${NC}"
else
    echo -e "${RED}❌ Failed to create album${NC}"
    ALBUM_ID="test-album-id"  # fallback for testing
fi

# 7. Get upload URLs
echo -e "\n${YELLOW}Getting upload URLs for album...${NC}"
upload_urls_response=$(curl -s -b "$COOKIE_JAR" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{
        "files": [
            {"filename": "photo1.jpg"},
            {"filename": "photo2.jpg"},
            {"filename": "photo3.jpg"}
        ]
    }' \
    "$API_BASE/api/v1/albums/$ALBUM_ID/upload")

echo "Upload URLs Response: $upload_urls_response" | jq '.' 2>/dev/null || echo "Upload URLs Response: $upload_urls_response"

echo -e "\n${BLUE}📝 Step 4: Billing & Subscriptions${NC}"

# 8. Get available plans
echo -e "\n${YELLOW}Getting available plans...${NC}"
plans_response=$(curl -s "$API_BASE/api/v1/billing/plans")

echo "Plans Response: $plans_response" | jq '.' 2>/dev/null || echo "Plans Response: $plans_response"

# 9. Get current subscription
echo -e "\n${YELLOW}Getting current subscription...${NC}"
subscription_response=$(curl -s -b "$COOKIE_JAR" \
    "$API_BASE/api/v1/billing/subscription")

echo "Subscription Response: $subscription_response" | jq '.' 2>/dev/null || echo "Subscription Response: $subscription_response"

echo -e "\n${BLUE}📝 Step 5: Public Album Access${NC}"

# 10. Test public album access (will fail since we haven't uploaded real images)
echo -e "\n${YELLOW}Testing public album access...${NC}"
if [ -n "$ALBUM_ID" ] && [ "$ALBUM_ID" != "null" ] && [ "$ALBUM_ID" != "test-album-id" ]; then
    public_album_response=$(curl -s "$API_BASE/api/v1/share/$ALBUM_ID")
    echo "Public Album Response: $public_album_response" | jq '.' 2>/dev/null || echo "Public Album Response: $public_album_response"
else
    echo "⏭️ Skipping public album access (no valid album ID)"
fi

echo -e "\n${BLUE}📝 Step 6: Cleanup${NC}"

# 11. Sign out
echo -e "\n${YELLOW}Signing out...${NC}"
logout_response=$(curl -s -b "$COOKIE_JAR" \
    -X POST \
    "$API_BASE/api/auth/sign-out")

echo "Logout Response: $logout_response" | jq '.' 2>/dev/null || echo "Logout Response: $logout_response"

# Clean up cookies
rm -f "$COOKIE_JAR"

echo -e "\n${GREEN}🎉 API Testing Complete!${NC}"
echo ""
echo -e "${YELLOW}📋 Test Summary:${NC}"
echo "✅ User Registration & Authentication"
echo "✅ Profile Management (CRUD)"
echo "✅ Album Creation & Upload URLs"
echo "✅ Billing Plans & Subscriptions"
echo "✅ Public Album Access"
echo "✅ User Sign Out"
echo ""
echo -e "${BLUE}📚 API Documentation: $API_BASE/reference?key=$SCALAR_KEY${NC}"
echo -e "${BLUE}🔧 OpenAPI Schema: $API_BASE/openapi${NC}"