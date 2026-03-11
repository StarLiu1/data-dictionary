import { GitHubAuthProvider } from './GitHubAuthProvider.jsx';
import DataDictionaryUI from './data_dictionary_ui.jsx';

function App() {
  return (
    <GitHubAuthProvider>
      <DataDictionaryUI />
    </GitHubAuthProvider>
  );
}

export default App;