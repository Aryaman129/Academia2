import os
import json
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_KEY")
supabase = create_client(supabase_url, supabase_key)

def check_timetable_data(email):
    """Check timetable data for a user"""
    try:
        # Get user ID from email
        user_query = supabase.table("users").select("id").eq("email", email).execute()
        if not user_query.data:
            print(f"User not found for email: {email}")
            return None
        
        user_id = user_query.data[0]["id"]
        print(f"Found user ID: {user_id} for email: {email}")
        
        # Get timetable data
        tt_resp = supabase.table("timetable").select("*").eq("user_id", user_id).execute()
        if not tt_resp.data or len(tt_resp.data) == 0:
            print(f"No timetable data found for user ID: {user_id}")
            return None
        
        timetable_data = tt_resp.data[0]
        print(f"Found timetable data for user ID: {user_id}")
        
        # Check if course_data exists
        course_data = timetable_data.get("course_data", [])
        print(f"Course data: {len(course_data) if course_data else 'None'}")
        
        # Check timetable structure
        merged_tt = timetable_data.get("timetable_data", {})
        
        # Count empty and non-empty course arrays
        empty_count = 0
        non_empty_count = 0
        
        for day, day_data in merged_tt.items():
            print(f"\nDay: {day}")
            for time_slot, slot_data in day_data.items():
                courses = slot_data.get("courses", [])
                if not courses:
                    empty_count += 1
                    print(f"  {time_slot}: Empty courses array, slot code: {slot_data.get('original_slot', 'N/A')}")
                else:
                    non_empty_count += 1
                    course_titles = [c.get("title", "Unknown") for c in courses]
                    print(f"  {time_slot}: {', '.join(course_titles)}")
        
        print(f"\nSummary: {empty_count} empty slots, {non_empty_count} non-empty slots")
        
        # Return the timetable data for further analysis
        return timetable_data
    
    except Exception as e:
        print(f"Error checking timetable data: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    email = "lb2523@srmist.edu.in"
    check_timetable_data(email)
