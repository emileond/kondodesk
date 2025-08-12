import { useMemo, useCallback } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
    getFilteredRowModel,
    getPaginationRowModel,
} from '@tanstack/react-table';
import { Pagination, PaginationItem, PaginationCursor } from '@heroui/react';
import { RiArrowDownLine, RiArrowUpLine } from 'react-icons/ri';

// Memoized DataGrid component for better performance
const DataGrid = ({ data = [], columns = [], options = {}, onRowClick, pageSize = 10 }) => {
    // Memoize the table instance to prevent unnecessary re-renders
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        // Default pagination settings
        initialState: {
            pagination: { pageSize },
            ...options?.initialState,
        },
        ...options,
    });

    // Memoize the row click handler to prevent unnecessary re-renders
    const handleRowClick = useCallback(
        (row) => {
            if (onRowClick) {
                onRowClick(row);
            }
        },
        [onRowClick],
    );

    // Memoize the header rendering
    const tableHeader = useMemo(
        () => (
            <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className="border-b border-default-200">
                        {headerGroup.headers.map((header) => (
                            <th
                                key={header.id}
                                className={`px-4 py-3 text-left font-medium text-default-600 ${header.column.columnDef.className || ''}`}
                                style={header.column.columnDef.style}
                            >
                                {header.isPlaceholder ? null : (
                                    <div
                                        className={
                                            header.column.getCanSort()
                                                ? 'cursor-pointer select-none'
                                                : ''
                                        }
                                        onClick={header.column.getToggleSortingHandler()}
                                    >
                                        <div className="flex items-center gap-1 w-full text-sm">
                                            {flexRender(
                                                header.column.columnDef.header,
                                                header.getContext(),
                                            )}
                                            {{
                                                asc: <RiArrowUpLine />,
                                                desc: <RiArrowDownLine />,
                                            }[header.column.getIsSorted()] ?? null}
                                        </div>
                                    </div>
                                )}
                            </th>
                        ))}
                    </tr>
                ))}
            </thead>
        ),
        [table, table.getState().sorting],
    );

    // Get rows from the table model
    const { rows } = table.getRowModel();

    // Memoize the body rendering with pagination
    const tableBody = useMemo(
        () => (
            <tbody>
                {rows.map((row) => (
                    <tr
                        key={row.id}
                        className={`border-b border-default-100 ${onRowClick ? 'cursor-pointer hover:bg-content2' : ''}`}
                        onClick={() => handleRowClick(row.original)}
                    >
                        {row.getVisibleCells().map((cell) => (
                            <td
                                key={cell.id}
                                className={`px-4 py-3 ${cell.column.columnDef.cellClassName || ''} text-sm`}
                                style={cell.column.columnDef.cellStyle}
                            >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                        ))}
                    </tr>
                ))}

                {rows.length === 0 && (
                    <tr>
                        <td colSpan={columns.length} className="text-center py-8">
                            No data available
                        </td>
                    </tr>
                )}
            </tbody>
        ),
        [rows, columns.length, handleRowClick, onRowClick],
    );

    // Calculate pagination details
    const { pageIndex } = table.getState().pagination;
    const pageCount = table.getPageCount();

    return (
        <div className="flex flex-col gap-4">
            <div className="overflow-auto">
                <table className="w-full border-collapse" aria-label="Data grid table">
                    {tableHeader}
                    {tableBody}
                </table>
            </div>

            {/* Pagination UI */}
            {pageCount > 1 && (
                <div className="flex justify-center pb-6">
                    <Pagination
                        size="sm"
                        variant="light"
                        showControls
                        total={pageCount}
                        initialPage={pageIndex + 1}
                        page={pageIndex + 1}
                        onChange={(page) => table.setPageIndex(page - 1)}
                        className="gap-2"
                    >
                        <PaginationItem>
                            {({ page, isActive }) => (
                                <button
                                    className={`w-8 h-8 rounded-md ${
                                        isActive ? 'bg-primary text-white' : 'bg-default-100'
                                    }`}
                                >
                                    {page}
                                </button>
                            )}
                        </PaginationItem>
                        <PaginationCursor />
                    </Pagination>
                </div>
            )}
        </div>
    );
};

export default DataGrid;
