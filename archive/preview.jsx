import React from 'react'
import { createRoot } from 'react-dom/client'
import CurvedExpansionBagCalculator from './tabs/CurvedExpansionBagCalculator.jsx'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CurvedExpansionBagCalculator />
  </React.StrictMode>
)
