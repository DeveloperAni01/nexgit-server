 
import fetch from 'node-fetch';

const response = await fetch('http://localhost:3000/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        error: 'fatal: not a git repository',
        language: 'hinglish'
      })
});

const data = await response.json();
console.log(data);