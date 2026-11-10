#!/usr/bin/env python3
"""
Verification script to test all changes made to the NBA Intelligence Platform.
Run this after starting the backend to verify everything works.
"""

import requests
import sys
from typing import List, Dict

BACKEND_URL = "http://127.0.0.1:8000"

def test_health_check() -> bool:
    """Test if backend is running."""
    try:
        response = requests.get(f"{BACKEND_URL}/api/health", timeout=5)
        if response.status_code == 200:
            print("✅ Backend health check passed")
            return True
        else:
            print(f"❌ Backend health check failed: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Backend not reachable: {e}")
        print("   Make sure to run: uvicorn main:app --reload")
        return False

def test_2026_draft_players() -> bool:
    """Test if 2026 draft players are available."""
    try:
        response = requests.get(f"{BACKEND_URL}/api/players", timeout=10)
        if response.status_code != 200:
            print(f"❌ Players endpoint failed: {response.status_code}")
            return False
        
        players = response.json()
        
        # Test players from 2026 draft
        test_players = [
            "AJ Dybantsa",
            "Darryn Peterson", 
            "Cameron Boozer",
            "Caleb Wilson",
            "Keaton Wagler"
        ]
        
        found_players = []
        for player in players:
            if player.get('full_name') in test_players:
                found_players.append(player['full_name'])
        
        if len(found_players) >= 3:  # At least 3 out of 5 should be found
            print(f"✅ 2026 Draft players found: {', '.join(found_players)}")
            return True
        else:
            print(f"⚠️  Only found {len(found_players)} draft players: {found_players}")
            print("   Expected: AJ Dybantsa, Darryn Peterson, Cameron Boozer, etc.")
            return False
            
    except Exception as e:
        print(f"❌ Error testing draft players: {e}")
        return False

def test_player_count() -> bool:
    """Test total player count."""
    try:
        response = requests.get(f"{BACKEND_URL}/api/players", timeout=10)
        if response.status_code != 200:
            print(f"❌ Players endpoint failed: {response.status_code}")
            return False
        
        players = response.json()
        total = len(players)
        active = sum(1 for p in players if p.get('is_active', False))
        
        print(f"✅ Total players: {total} ({active} active)")
        
        # Should have at least 5103 + 60 draft picks
        if total >= 5160:
            return True
        else:
            print(f"⚠️  Expected at least 5160 players, got {total}")
            return False
            
    except Exception as e:
        print(f"❌ Error counting players: {e}")
        return False

def test_awards_data() -> bool:
    """Test if 2025-26 awards are present."""
    try:
        response = requests.get(f"{BACKEND_URL}/api/awards", timeout=10)
        if response.status_code != 200:
            print(f"❌ Awards endpoint failed: {response.status_code}")
            return False
        
        awards = response.json()
        
        # Check if 2025-26 season exists
        if len(awards) > 0 and awards[0].get('season') == '2025-26':
            print("✅ 2025-26 awards data found")
            winners = awards[0].get('winners', {})
            print(f"   MVP: {winners.get('mvp', {}).get('player', 'N/A')}")
            print(f"   ROTY: {winners.get('roy', {}).get('player', 'N/A')}")
            return True
        else:
            print("⚠️  2025-26 awards not found at index 0")
            return False
            
    except Exception as e:
        print(f"❌ Error testing awards: {e}")
        return False

def check_frontend_env() -> bool:
    """Check frontend environment configuration."""
    import os
    
    env_path = "frontend/.env"
    env_local_path = "frontend/.env.local"
    
    print("\n📁 Frontend Environment Check:")
    
    # Check .env
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            env_content = f.read()
            
        # Should NOT have localhost URL uncommented
        if "VITE_API_BASE_URL=http://127.0.0.1:8000" in env_content:
            lines = env_content.split('\n')
            uncommented = [line for line in lines if line.strip().startswith('VITE_API_BASE_URL=http://127.0.0.1')]
            if uncommented:
                print(f"⚠️  .env has localhost URL uncommented (will break deployment)")
                print(f"   Line: {uncommented[0]}")
                return False
        
        print("✅ .env is correctly configured for production")
    else:
        print("⚠️  .env file not found")
    
    # Check .env.local
    if os.path.exists(env_local_path):
        with open(env_local_path, 'r') as f:
            env_local_content = f.read()
            
        if "VITE_API_BASE_URL=http://127.0.0.1:8000/api" in env_local_content:
            print("✅ .env.local correctly configured for local development")
            return True
        else:
            print("⚠️  .env.local missing localhost URL")
            return False
    else:
        print("⚠️  .env.local not found (needed for local development)")
        print("   Run: echo 'VITE_API_BASE_URL=http://127.0.0.1:8000/api' > frontend/.env.local")
        return False

def main():
    """Run all verification tests."""
    print("=" * 60)
    print("NBA Intelligence Platform - Verification Script")
    print("=" * 60)
    print()
    
    # Backend tests
    print("🔍 Testing Backend (http://127.0.0.1:8000)...\n")
    
    tests = [
        ("Health Check", test_health_check),
        ("Player Count", test_player_count),
        ("2026 Draft Players", test_2026_draft_players),
        ("2025-26 Awards", test_awards_data),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append(result)
        except Exception as e:
            print(f"❌ {name} crashed: {e}")
            results.append(False)
        print()
    
    # Frontend configuration check
    config_ok = check_frontend_env()
    results.append(config_ok)
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    passed = sum(results)
    total = len(results)
    
    if passed == total:
        print(f"✅ All {total} tests passed!")
        print("\nYou can now:")
        print("1. Test the frontend: cd frontend && npm run dev")
        print("2. Deploy to production: git add . && git commit && git push")
    else:
        print(f"⚠️  {passed}/{total} tests passed")
        print(f"❌ {total - passed} test(s) failed")
        print("\nPlease fix the issues above before deploying.")
        sys.exit(1)

if __name__ == "__main__":
    main()
