import requests
import json
import base64

LOGIN_URL = "https://academia.srmist.edu.in/accounts/signin.ac"

HEADERS = {
    'Origin': 'https://academia.srmist.edu.in',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.89 Safari/537.36'
}

def get_auth_token(username, password):
    session = requests.Session()  # Maintains session persistence
    
    payload = {
        'username': username,
        'password': password,
        'client_portal': 'true',  
        'portal': '10002227248',  
        'is_ajax': 'true',
        'grant_type': 'password'
    }

    try:
        response = session.post(LOGIN_URL, data=payload, headers=HEADERS)
        response.raise_for_status()  # Raises error if request fails
        
        # Parse JSON response
        try:
            data = response.json()
        except json.JSONDecodeError:
            return json.dumps({"status": "error", "msg": "Invalid JSON response from server."})

        # Check if authentication was successful
        if "error" in data:
            return json.dumps({"status": "error", "msg": data['error'].get('msg', "Login failed.")})

        # Extract cookies (authentication token)
        cookies = session.cookies.get_dict()
        if not cookies:
            return json.dumps({"status": "error", "msg": "Authentication failed. No session token found."})

        # Encode cookies as token
        token = base64.b64encode(json.dumps(cookies).encode()).decode()
        return json.dumps({"status": "success", "token": token})

    except requests.exceptions.RequestException as e:
        return json.dumps({"status": "error", "msg": str(e)})

# Example Usage
print(get_auth_token("your_username", "your_password"))
