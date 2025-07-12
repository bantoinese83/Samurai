#!/usr/bin/env python3
"""
Setup script for Gemini API integration in StemSep+
"""

import os
import sys

def setup_gemini_api():
    """
    Interactive setup for Gemini API key configuration
    """
    print("🧠 StemSep+ Gemini AI Integration Setup")
    print("=" * 50)
    
    # Check if API key is already set
    current_key = os.getenv('GEMINI_API_KEY')
    if current_key:
        print(f"✅ Gemini API key is already configured")
        print(f"   Current key: {current_key[:8]}...{current_key[-4:]}")
        
        test_choice = input("\nWould you like to test the current API key? (y/n): ").lower()
        if test_choice == 'y':
            test_api_key(current_key)
        
        change_choice = input("\nWould you like to change the API key? (y/n): ").lower()
        if change_choice != 'y':
            return
    
    print("\n📝 Setting up Gemini API key...")
    print("   1. Go to https://makersuite.google.com/app/apikey")
    print("   2. Create a new API key")
    print("   3. Copy the API key and paste it below")
    print()
    
    api_key = input("Enter your Gemini API key: ").strip()
    
    if not api_key:
        print("❌ No API key provided. Setup cancelled.")
        return
    
    # Test the API key
    if test_api_key(api_key):
        # Set environment variable for current session
        os.environ['GEMINI_API_KEY'] = api_key
        
        # Provide instructions for permanent setup
        print("\n🔧 To make this permanent, add this to your shell configuration:")
        print(f"   export GEMINI_API_KEY='{api_key}'")
        print("\n   Or create a .env file in the server directory:")
        print(f"   echo 'GEMINI_API_KEY={api_key}' > .env")
        
        # Optionally create .env file
        env_choice = input("\nWould you like to create a .env file automatically? (y/n): ").lower()
        if env_choice == 'y':
            with open('.env', 'w') as f:
                f.write(f'GEMINI_API_KEY={api_key}\n')
            print("✅ .env file created successfully!")
            print("   Note: Make sure to add .env to your .gitignore file")
        
        print("\n🎉 Gemini API setup complete!")
        print("   Your StemSep+ server will now include AI-powered audio understanding")
    else:
        print("❌ Setup failed. Please check your API key and try again.")

def test_api_key(api_key):
    """
    Test the provided API key using the new Google GenAI SDK
    """
    print(f"\n🧪 Testing API key: {api_key[:8]}...{api_key[-4:]}")
    
    try:
        import google.generativeai as genai
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents="Hello, can you hear me?"
        )
        if hasattr(response, 'text') and response.text:
            print("✅ API key is valid and working!")
            print(f"   Test response: {response.text[:50]}...")
            return True
        else:
            print("❌ API key test failed: No response received")
            return False
    except Exception as e:
        print(f"❌ API key test failed: {str(e)}")
        return False

def check_dependencies():
    """
    Check if required dependencies are installed
    """
    print("\n🔍 Checking dependencies...")
    try:
        import google.generativeai as genai
        print("✅ google-genai is installed")
    except ImportError:
        print("❌ google-genai is not installed")
        print("   Install with: pip install google-genai")
        return False
    try:
        import librosa
        print("✅ librosa is installed")
    except ImportError:
        print("❌ librosa is not installed")
        print("   Install with: pip install librosa")
        return False
    return True

if __name__ == "__main__":
    print("🎵 StemSep+ AI Audio Understanding Setup")
    print("=" * 50)
    if not check_dependencies():
        print("\n❌ Missing dependencies. Please install them first.")
        sys.exit(1)
    setup_gemini_api()
    print("\n🚀 Setup complete! You can now start your StemSep+ server with AI features.")
    print("   Run: python audio_api.py") 