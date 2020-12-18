import React, { useEffect } from 'react';
import { loadImageData } from './loadImageData';

export function App() {
  useEffect(() => {
    loadImageData("the-persistence-of-memory.jpg").then(console.log);
  }, []);
  return <img src="the-persistence-of-memory.jpg" width={800} />;
}