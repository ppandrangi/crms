// app/components/ui/Modal.tsx
'use client';

import React, { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void; // Function to call when closing the modal (e.g., clicking backdrop or close button)
  onConfirm?: () => void; // Optional function for confirm button
  title: string;
  children: ReactNode; // Content of the modal body
  confirmText?: string; // Text for the confirm button (optional)
  cancelText?: string; // Text for the cancel button (optional)
  isConfirmDisabled?: boolean; // Optional: disable confirm button (e.g., while loading)
}

export default function Modal({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isConfirmDisabled = false,
}: ModalProps) {

  // If the modal is not open, render nothing
  if (!isOpen) {
    return null;
  }

  // Prevent clicks inside the modal content from closing it
  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    // Backdrop: semi-transparent background, closes modal on click
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
      onClick={onClose} // Close modal when clicking the backdrop
    >
      {/* Modal Content Container */}
      <div
        className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6 text-white"
        onClick={handleContentClick} // Prevent closing when clicking inside content
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-3">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl font-bold"
            aria-label="Close modal"
          >
            &times; {/* Close icon */}
          </button>
        </div>

        {/* Modal Body (renders children passed as props) */}
        <div className="mb-6">{children}</div>

        {/* Modal Footer (only shown if onConfirm is provided) */}
        {onConfirm && (
            <div className="flex justify-end space-x-3 border-t border-gray-700 pt-4">
            <button
                onClick={onClose}
                type="button"
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-500"
            >
                {cancelText}
            </button>
            <button
                onClick={onConfirm}
                type="button"
                disabled={isConfirmDisabled}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 disabled:opacity-50"
            >
                {isConfirmDisabled ? 'Processing...' : confirmText}
            </button>
            </div>
        )}
      </div>
    </div>
  );
}
