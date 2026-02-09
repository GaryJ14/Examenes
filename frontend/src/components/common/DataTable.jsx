

// ============================================
// src/components/common/DataTable.jsx
// ============================================
import React from 'react';
import { Table, Badge } from 'react-bootstrap';
import LoadingSpinner from './LoadingSpinner';

const DataTable = ({
  columns,
  data,
  loading = false,
  emptyMessage = 'No hay datos disponibles',
  striped = true,
  hover = true,
  responsive = true,
}) => {
  if (loading) {
    return <LoadingSpinner />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center p-4 text-muted">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const TableComponent = responsive ? Table : 'table';
  const tableProps = responsive ? { responsive: true } : {};

  return (
    <TableComponent striped={striped} hover={hover} {...tableProps}>
      <thead>
        <tr>
          {columns.map((column, index) => (
            <th key={index} className={column.className}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {columns.map((column, colIndex) => (
              <td key={colIndex} className={column.className}>
                {column.render ? column.render(row) : row[column.field]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </TableComponent>
  );
};

export default DataTable;

