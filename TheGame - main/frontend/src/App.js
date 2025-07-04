import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

// --- UI Components ---
const InstructionsModal = ({ onStartGame }) => (
  <div className="modal-overlay">
    <div className="modal-content">
      <h2>How to Play</h2>
      <ul>
        <li>Find groups of four words that share a common theme.</li>
        <li>Select four words and press 'Submit'.</li>
        <li>Correct groups earn points. Fewer mistakes mean a bigger bonus!</li>
        <li>Win every day to build up your streak.</li>
      </ul>
      <button className="play-button" onClick={onStartGame}>Let's Go!</button>
    </div>
  </div>
);

const HomeScreen = ({ onPlay, score, streak }) => (
  <div className="home-screen">
    <GameStats score={score} streak={streak} />
    <h1>GridConnect</h1>
    <p className="tagline">Find the connection. Solve the grid.</p>
    <button className="play-button" onClick={onPlay}>Play Today's Puzzle</button>
  </div>
);

const GameStats = ({ score, streak }) => (
  <div className="game-stats">
    <div className="stat-item">
      <span>SCORE</span>
      <div>⭐ {score}</div>
    </div>
    <div className="stat-item">
      <span>STREAK</span>
      <div>🔥 {streak}</div>
    </div>
  </div>
);

function App() {
  // --- STATE MANAGEMENT ---
  const [gameState, setGameState] = useState('home');
  const [gridWords, setGridWords] = useState([]);
  const [solvedGroups, setSolvedGroups] = useState([]);
  const [selectedWords, setSelectedWords] = useState([]);
  const [mistakesLeft, setMistakesLeft] = useState(4);
  const [message, setMessage] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  
  // --- LOCALSTORAGE & PERSISTENCE ---
  useEffect(() => {
    try {
      const savedData = JSON.parse(localStorage.getItem('gridConnectData'));
      if (savedData) {
        setScore(savedData.score || 0);
        setStreak(savedData.streak || 0);
      }
    } catch (error) {
      console.error("Could not parse saved data.", error);
    }
  }, []);

  const saveData = (newScore, newStreak, lastPlayedDate) => {
    try {
      const dataToSave = { score: newScore, streak: newStreak, lastPlayed: lastPlayedDate };
      localStorage.setItem('gridConnectData', JSON.stringify(dataToSave));
    } catch (error) {
      console.error("Could not save data.", error);
    }
  };

  // --- CORE GAME FUNCTIONS ---
  const fetchPuzzle = useCallback(async () => {
    setIsLoading(true);
    setSolvedGroups([]);
    setSelectedWords([]);
    setMistakesLeft(4);
    setIsGameOver(false);
    setMessage('Find four words that share something in common.');
    try {
      const response = await axios.get(`${API_URL}/api/today`);
      setGridWords(shuffleArray([...response.data.words]));
    } catch (error) {
      console.error("Error fetching puzzle:", error);
      setMessage('Error connecting to the server!');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleStartGame = () => {
    setGameState('playing');
    fetchPuzzle();
  };

  const calculatePoints = (mistakes) => {
    if (mistakes === 4) return 20; // Perfect game
    if (mistakes === 3) return 15;
    if (mistakes === 2) return 10;
    if (mistakes === 1) return 5;
    return 0; // No bonus if all mistakes used
  };

  const handleWin = () => {
    const pointsEarned = 10 + calculatePoints(mistakesLeft);
    const newScore = score + pointsEarned;
    setMessage(`You win! +${pointsEarned} points!`);
    
    const today = new Date().toDateString();
    const savedData = JSON.parse(localStorage.getItem('gridConnectData')) || {};
    const lastPlayed = savedData.lastPlayed;
    
    let newStreak = streak;
    if (lastPlayed !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        newStreak = lastPlayed === yesterday.toDateString() ? streak + 1 : 1;
    }
    
    setScore(newScore);
    setStreak(newStreak);
    saveData(newScore, newStreak, today);
    setIsGameOver(true);
  };

  const handleWordClick = (word) => {
    if (isGameOver) return;
    if (selectedWords.includes(word)) {
      setSelectedWords(prev => prev.filter(w => w !== word));
    } else if (selectedWords.length < 4) {
      setSelectedWords(prev => [...prev, word]);
    }
  };

  const handleSubmit = async () => {
    if (selectedWords.length !== 4) return;
    try {
      const response = await axios.post(`${API_URL}/api/check`, { selection: selectedWords });
      const { isCorrect, group } = response.data;
      if (isCorrect) {
        setSolvedGroups(prev => [...prev, group]);
        setGridWords(prev => prev.filter(w => !selectedWords.includes(w)));
        setSelectedWords([]);
        if (solvedGroups.length + 1 === 4) {
          handleWin();
        } else {
          setMessage("Correct! One group down.");
        }
      } else {
        const newMistakesLeft = mistakesLeft - 1;
        setMistakesLeft(newMistakesLeft);
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
        if (newMistakesLeft === 0) {
          setMessage("Game Over! Better luck tomorrow.");
          setIsGameOver(true);
        } else {
          setMessage("Not a group. Try again.");
        }
      }
    } catch (error) {
      console.error("Error checking submission:", error);
      setMessage("Error submitting guess. Check the server.");
    }
  };

  const handleDeselectAll = () => setSelectedWords([]);
  const handleShuffle = () => setGridWords(prev => shuffleArray([...prev]));
  const handlePlayAgain = () => setGameState('home');
  
  // --- MAIN RENDER LOGIC ---
  const renderContent = () => {
    switch (gameState) {
      case 'instructions':
        return <InstructionsModal onStartGame={handleStartGame} />;
      case 'playing':
        if (isLoading) return <div className="loading-screen"><h1>GridConnect</h1><p>Loading...</p></div>;
        return (
          <>
            <header>
              <GameStats score={score} streak={streak} />
              <h1>GridConnect</h1>
              <p>{message}</p>
            </header>
            <main>
              <div className="solved-groups-container">{solvedGroups.map((group, index) => (<div key={group.name} className="solved-group" style={{ backgroundColor: `hsl(${index * 60 + 210}, 100%, 85%)` }}><strong>{group.name}</strong><p>{group.words.join(', ')}</p></div>))}</div>
              <div className={`word-grid ${isShaking ? 'shake' : ''}`}>{gridWords.map(word => (<button key={word} className={`word-tile ${selectedWords.includes(word) ? 'selected' : ''}`} onClick={() => handleWordClick(word)} disabled={isGameOver}>{word}</button>))}</div>
              <div className="mistakes-container"><span>Mistakes remaining:</span><div className="mistake-dots">{[...Array(4)].map((_, i) => (<span key={i} className={`dot ${i >= mistakesLeft ? 'lost' : ''}`}></span>))}</div></div>
              {!isGameOver ? (<div className="action-buttons"><button onClick={handleShuffle}>Shuffle</button><button onClick={handleDeselectAll} disabled={selectedWords.length === 0}>Deselect All</button><button onClick={handleSubmit} disabled={selectedWords.length !== 4} className="submit-button">Submit</button></div>) : (<div className="action-buttons"><button onClick={handlePlayAgain}>Back to Home</button></div>)}
            </main>
          </>
        );
      case 'home':
      default:
        return <HomeScreen onPlay={() => setGameState('instructions')} score={score} streak={streak} />;
    }
  };

  return <div className="App">{renderContent()}</div>;
}

export default App;