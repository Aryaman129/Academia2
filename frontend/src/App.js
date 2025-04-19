import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Auth from "./components/Auth";
import Dashboard from "./components/Dashboard";
import NotificationListener from "./components/NotificationListener";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import "./App.css";

function App() {
  return (
    <div className="App">
      {/* Add ToastContainer directly */}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        closeOnClick
        pauseOnHover
        draggable
      />
      <Router>
        <header className="App-header">
          <h1>Academia Student Portal <span className="testing-label">(Testing Version)</span></h1>
        </header>
        <Routes>
          <Route path="/" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
        <NotificationListener />
      </Router>
    </div>
  );
}

export default App;