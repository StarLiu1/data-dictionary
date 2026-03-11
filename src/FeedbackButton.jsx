/**
 * FeedbackButton
 * 
 * A small button that opens the CreateIssueModal.
 * Place on table headers and column rows.
 */
import { useState } from 'react';
import CreateIssueModal from './CreateIssueModal.jsx';

const styles = {
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 8px',
    backgroundColor: 'transparent',
    color: '#586069',
    border: '1px solid #d0d7de',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  },
  buttonHover: {
    backgroundColor: '#f6f8fa',
    borderColor: '#0969da',
    color: '#0969da',
  },
};

export default function FeedbackButton({ tableName, columnName, label, onIssueCreated }) {
  const [showModal, setShowModal] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <>
      <button
        style={{ ...styles.button, ...(hovered ? styles.buttonHover : {}) }}
        onClick={(e) => {
          e.stopPropagation();
          setShowModal(true);
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title={columnName ? `Feedback on ${tableName}.${columnName}` : `Feedback on ${tableName}`}
      >
        💬 {label || 'Feedback'}
      </button>

      {showModal && (
        <CreateIssueModal
          tableName={tableName}
          columnName={columnName}
          onClose={() => setShowModal(false)}
          onIssueCreated={(issue) => {
            if (onIssueCreated) onIssueCreated(issue);
          }}
        />
      )}
    </>
  );
}
