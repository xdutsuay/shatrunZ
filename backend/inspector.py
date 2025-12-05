"""
ShatrunZ Game Inspector
Analyzes games and provides AI training insights
Runs continuously, monitoring for new games
"""

import json
import time
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# Directories
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / 'data'
GAMES_DIR = DATA_DIR / 'games'
LOGS_DIR = DATA_DIR / 'logs'

# Piece values (updated with Krishna > Queen)
PIECE_VALUES = {
    'p': 100,
    'n': 320,
    'b': 330,
    'r': 500,
    'q': 900,
    'k': 20000,
    'z': 1200  # Krishna: More valuable than Queen (can't be captured!)
}

class GameInspector:
    def __init__(self):
        self.analyzed_games = set()
        self.insights = defaultdict(list)
        
    def analyze_game(self, game_data):
        """Analyze a completed game and extract insights"""
        
        white = game_data.get('white', 'Unknown')
        black = game_data.get('black', 'Unknown')
        result = game_data.get('result', '*')
        moves = game_data.get('moves', [])
        
        print(f"\n{'='*60}")
        print(f"🔍 ANALYZING GAME: {white} vs {black}")
        print(f"📊 Result: {result} | Moves: {len(moves)}")
        print(f"{'='*60}\n")
        
        # Determine winner/loser
        if result == '1-0':
            winner, loser = white, black
        elif result == '0-1':
            winner, loser = black, white
        else:
            winner, loser = None, None
        
        # Analysis categories
        insights = {
            'material': self.analyze_material_play(moves, winner, loser),
            'positional': self.analyze_positional_play(moves, winner, loser),
            'aggressive': self.analyze_aggressive_play(moves, winner, loser),
            'endgame': self.analyze_endgame(moves, result),
            'mistakes': self.find_mistakes(moves, result)
        }
        
        # Print insights
        self.print_insights(insights, white, black, result)
        
        # Save insights to log
        self.save_insights(game_data, insights)
        
        return insights
    
    def analyze_material_play(self, moves, winner, loser):
        """Analyze material-based decisions"""
        insights = []
        
        # Check if material advantage was converted
        if winner and 'Material' in winner:
            insights.append("✅ Material AI successfully converted advantage")
            insights.append("💡 Suggestion: Maintain piece value awareness")
        elif loser and 'Material' in loser:
            insights.append("❌ Material AI failed to convert advantage")
            insights.append("💡 Suggestion: Improve endgame technique")
            insights.append("💡 Suggestion: Add 'winning when ahead' logic")
        
        return insights
    
    def analyze_positional_play(self, moves, winner, loser):
        """Analyze positional decisions"""
        insights = []
        
        if winner and 'Positional' in winner:
            insights.append("✅ Positional AI's piece placement was superior")
            insights.append("💡 Suggestion: Current piece-square tables are effective")
        elif loser and 'Positional' in loser:
            insights.append("❌ Positional AI's setup was insufficient")
            insights.append("💡 Suggestion: Increase king safety weight")
            insights.append("💡 Suggestion: Add pawn structure evaluation")
        
        # Check move count
        if len(moves) > 100:
            insights.append("⚠️  Game too long - improve decision making")
        
        return insights
    
    def analyze_aggressive_play(self, moves, winner, loser):
        """Analyze aggressive/tactical play"""
        insights = []
        
        if winner and 'Aggressive' in winner:
            insights.append("✅ Aggressive AI's attacks were effective")
            insights.append("💡 Suggestion: Maintain attack bonuses")
        elif loser and 'Aggressive' in loser:
            insights.append("❌ Aggressive AI overextended")
            insights.append("💡 Suggestion: Balance aggression with safety")
            insights.append("💡 Suggestion: Add 'king safety' check before attacking")
        
        return insights
    
    def analyze_endgame(self, moves, result):
        """Analyze endgame performance"""
        insights = []
        
        if result == '1/2-1/2':
            insights.append("⚠️  DRAW - Endgame technique needs improvement!")
            insights.append("💡 CRITICAL: Add passed pawn bonuses (+200)")
            insights.append("💡 CRITICAL: Add king activity in endgame (+50)")
            insights.append("💡 CRITICAL: Add 'trade when ahead' logic")
            insights.append("💡 CRITICAL: Increase search depth in endgame")
        else:
            if len(moves) > 80:
                insights.append("✅ Endgame was converted (but slowly)")
                insights.append("💡 Suggestion: Optimize endgame evaluation")
            else:
                insights.append("✅ Clean victory in middlegame")
        
        return insights
    
    def find_mistakes(self, moves, result):
        """Identify common mistakes"""
        insights = []
        
        # Check for repetition draws
        if result == '1/2-1/2' and 'Repetition' in str(result):
            insights.append("🔴 MAJOR ISSUE: Draw by repetition")
            insights.append("💡 FIX: Add repetition avoidance logic")
            insights.append("💡 FIX: Penalize moves that repeat positions")
            insights.append("💡 FIX: When ahead, avoid repetition at all costs")
        
        # Check for stalemate
        if result == '1/2-1/2' and 'Stalemate' in str(result):
            insights.append("🔴 MAJOR ISSUE: Stalemate when winning")
            insights.append("💡 FIX: Check for stalemate before moving")
            insights.append("💡 FIX: Leave opponent with legal moves")
        
        return insights
    
    def print_insights(self, insights, white, black, result):
        """Pretty print insights to terminal"""
        
        print(f"📈 INSIGHTS FOR {white}:")
        for category, items in insights.items():
            if items and white.split()[0] in str(items):
                print(f"\n  [{category.upper()}]")
                for item in items:
                    print(f"    {item}")
        
        print(f"\n📉 INSIGHTS FOR {black}:")
        for category, items in insights.items():
            if items and black.split()[0] in str(items):
                print(f"\n  [{category.upper()}]")
                for item in items:
                    print(f"    {item}")
        
        print(f"\n🎯 GENERAL INSIGHTS:")
        for category in ['endgame', 'mistakes']:
            if insights[category]:
                print(f"\n  [{category.upper()}]")
                for item in insights[category]:
                    print(f"    {item}")
        
        print(f"\n{'='*60}\n")
    
    def save_insights(self, game_data, insights):
        """Save insights to log file"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        log_file = LOGS_DIR / f"analysis_{timestamp}.txt"
        
        with open(log_file, 'w') as f:
            f.write(f"Game Analysis - {timestamp}\n")
            f.write(f"{'='*60}\n\n")
            f.write(f"White: {game_data.get('white')}\n")
            f.write(f"Black: {game_data.get('black')}\n")
            f.write(f"Result: {game_data.get('result')}\n")
            f.write(f"Moves: {len(game_data.get('moves', []))}\n\n")
            
            for category, items in insights.items():
                if items:
                    f.write(f"[{category.upper()}]\n")
                    for item in items:
                        f.write(f"  {item}\n")
                    f.write("\n")
    
    def monitor_games(self):
        """Continuously monitor for new games"""
        print("👁️  Game Inspector Started")
        print(f"📁 Monitoring: {GAMES_DIR}")
        print("Waiting for games...\n")
        
        while True:
            # Check for new analysis files
            for filepath in GAMES_DIR.glob('analysis_*.json'):
                if filepath not in self.analyzed_games:
                    try:
                        with open(filepath, 'r') as f:
                            game_data = json.load(f)
                        
                        self.analyze_game(game_data)
                        self.analyzed_games.add(filepath)
                        
                        # Clean up analysis file
                        filepath.unlink()
                        
                    except Exception as e:
                        print(f"❌ Error analyzing {filepath}: {e}")
            
            time.sleep(2)  # Check every 2 seconds

if __name__ == '__main__':
    inspector = GameInspector()
    
    try:
        inspector.monitor_games()
    except KeyboardInterrupt:
        print("\n\n👋 Inspector stopped")
