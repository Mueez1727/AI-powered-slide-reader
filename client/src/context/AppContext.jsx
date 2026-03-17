import { createContext, useContext, useReducer } from 'react';

const AppContext = createContext();

const initialState = {
  currentDocument: null,
  documents: [],
  chatHistory: [],
  isProcessing: false,
  sidebarOpen: true,
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_DOCUMENTS':
      return { ...state, documents: action.payload };
    case 'ADD_DOCUMENT':
      return { ...state, documents: [action.payload, ...state.documents] };
    case 'REMOVE_DOCUMENT':
      return { ...state, documents: state.documents.filter((d) => d._id !== action.payload) };
    case 'SET_CURRENT_DOCUMENT':
      return { ...state, currentDocument: action.payload };
    case 'SET_CHAT_HISTORY':
      return { ...state, chatHistory: action.payload };
    case 'ADD_CHAT_MESSAGE':
      return { ...state, chatHistory: [...state.chatHistory, action.payload] };
    case 'UPDATE_CHAT_MESSAGE':
      return {
        ...state,
        chatHistory: state.chatHistory.map((msg) =>
          msg.id === action.payload.id ? { ...msg, ...action.payload } : msg
        ),
      };
    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.payload };
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
