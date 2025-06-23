/**
 * @fileoverview React dropdown component using Lattice behavior
 */

import React, { useRef, useEffect } from 'react';
import { createZustandAdapter } from '@lattice/adapter-zustand';
import { useSliceValues } from '@lattice/frameworks/react';
import { createFullDropdown } from './dropdown-behavior';

// Create the dropdown store
const dropdownStore = createZustandAdapter(createFullDropdown);

interface DropdownProps {
  items: string[];
  placeholder?: string;
  onSelect?: (item: string) => void;
}

export function ReactDropdown({ items, placeholder = 'Select an item...', onSelect }: DropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Get reactive values from the store
  const { isOpen, selectedItem, highlightedIndex, searchQuery, filteredItems } = useSliceValues(dropdownStore);
  
  // Initialize items
  useEffect(() => {
    dropdownStore.actions.setItems(items);
  }, [items]);
  
  // Handle clicks outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        dropdownStore.actions.close();
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Handle selection
  const handleSelect = (index: number) => {
    dropdownStore.actions.selectIndex(index);
    const selected = filteredItems()[index];
    if (onSelect && selected) {
      onSelect(selected);
    }
  };
  
  return (
    <div className="dropdown-container" ref={dropdownRef}>
      <div className="dropdown-trigger">
        <button
          onClick={() => dropdownStore.actions.toggle()}
          onKeyDown={(e) => dropdownStore.actions.handleKeyDown(e.nativeEvent)}
          className="dropdown-button"
          aria-haspopup="listbox"
          aria-expanded={isOpen()}
        >
          <span>{selectedItem() || placeholder}</span>
          <svg className="dropdown-arrow" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </button>
      </div>
      
      {isOpen() && (
        <div className="dropdown-menu" role="listbox">
          <div className="dropdown-search">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search..."
              value={searchQuery()}
              onChange={(e) => dropdownStore.actions.setSearchQuery(e.target.value)}
              onKeyDown={(e) => dropdownStore.actions.handleSearchKeyDown(e.nativeEvent)}
              className="dropdown-search-input"
              autoFocus
            />
          </div>
          
          <ul className="dropdown-list">
            {filteredItems().map((item, index) => (
              <li
                key={item}
                role="option"
                aria-selected={selectedItem() === item}
                className={`dropdown-item ${
                  highlightedIndex() === index ? 'highlighted' : ''
                } ${selectedItem() === item ? 'selected' : ''}`}
                onMouseEnter={() => dropdownStore.actions.highlightIndex(index)}
                onClick={() => handleSelect(index)}
              >
                {item}
              </li>
            ))}
            {filteredItems().length === 0 && (
              <li className="dropdown-empty">No items found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// Demo component
export function ReactDropdownDemo() {
  const frameworks = [
    'React', 'Vue', 'Svelte', 'Angular', 'Solid', 
    'Preact', 'Alpine', 'Lit', 'Ember', 'Backbone'
  ];
  
  return (
    <div className="demo-container">
      <h2>React Dropdown Example</h2>
      <p>A fully accessible dropdown with keyboard navigation and search.</p>
      
      <ReactDropdown 
        items={frameworks}
        placeholder="Choose a framework..."
        onSelect={(item) => console.log('Selected:', item)}
      />
      
      <div className="demo-features">
        <h3>Features:</h3>
        <ul>
          <li>✅ Keyboard navigation (Arrow keys, Enter, Escape)</li>
          <li>✅ Search filtering</li>
          <li>✅ Click outside to close</li>
          <li>✅ Accessibility (ARIA attributes)</li>
          <li>✅ Mouse and keyboard support</li>
        </ul>
      </div>
      
      <style jsx>{`
        .demo-container {
          max-width: 400px;
          margin: 2rem auto;
          padding: 2rem;
          font-family: system-ui, -apple-system, sans-serif;
        }
        
        .dropdown-container {
          position: relative;
          width: 100%;
        }
        
        .dropdown-button {
          width: 100%;
          padding: 0.75rem 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 0.375rem;
          cursor: pointer;
          font-size: 1rem;
          transition: all 0.2s;
        }
        
        .dropdown-button:hover {
          border-color: #cbd5e0;
        }
        
        .dropdown-button:focus {
          outline: none;
          border-color: #4299e1;
          box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
        }
        
        .dropdown-arrow {
          width: 1.25rem;
          height: 1.25rem;
          color: #718096;
        }
        
        .dropdown-menu {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          margin-top: 0.25rem;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 0.375rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          z-index: 10;
          max-height: 300px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        
        .dropdown-search {
          padding: 0.5rem;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .dropdown-search-input {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.25rem;
          font-size: 0.875rem;
        }
        
        .dropdown-search-input:focus {
          outline: none;
          border-color: #4299e1;
        }
        
        .dropdown-list {
          margin: 0;
          padding: 0.25rem 0;
          list-style: none;
          overflow-y: auto;
          flex: 1;
        }
        
        .dropdown-item {
          padding: 0.5rem 1rem;
          cursor: pointer;
          transition: all 0.15s;
        }
        
        .dropdown-item:hover,
        .dropdown-item.highlighted {
          background: #f7fafc;
        }
        
        .dropdown-item.selected {
          background: #e6fffa;
          color: #047857;
          font-weight: 500;
        }
        
        .dropdown-empty {
          padding: 1rem;
          text-align: center;
          color: #718096;
        }
        
        .demo-features {
          margin-top: 2rem;
          padding: 1rem;
          background: #f7fafc;
          border-radius: 0.375rem;
        }
        
        .demo-features h3 {
          margin-top: 0;
          margin-bottom: 0.5rem;
          color: #2d3748;
        }
        
        .demo-features ul {
          margin: 0;
          padding-left: 1.5rem;
          color: #4a5568;
        }
        
        .demo-features li {
          margin: 0.25rem 0;
        }
      `}</style>
    </div>
  );
}