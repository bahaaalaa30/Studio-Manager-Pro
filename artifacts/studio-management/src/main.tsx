import { createRoot } from 'react-dom/client';

import App from './App';
import { installCustomerValidation } from './lib/customer-validation';

import './index.css';

installCustomerValidation();

createRoot(document.getElementById('root')!).render(<App />);
