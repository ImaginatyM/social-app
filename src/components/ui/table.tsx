"use client";
import * as React from "react";

type TableProps = React.HTMLAttributes<HTMLTableElement>

type TableRowProps = React.HTMLAttributes<HTMLTableRowElement>

type TableCellProps = React.TdHTMLAttributes<HTMLTableCellElement>

type TableHeadProps = React.ThHTMLAttributes<HTMLTableHeaderCellElement>

type TableBodyProps = React.HTMLAttributes<HTMLTableSectionElement>

type TableHeaderProps = React.HTMLAttributes<HTMLTableSectionElement>

type TableCaptionProps = React.HTMLAttributes<HTMLTableCaptionElement>

type TableFooterProps = React.HTMLAttributes<HTMLTableSectionElement>

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

const Table = React.forwardRef<HTMLTableElement, TableProps>
(function Table({className, ...props}, ref) {
  return (
    <div className="relative w-full overflow-auto">
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm text-foreground", className)}
        {...props}
      />
    </div>
  )
})
Table.displayName = "Table"

const TableHeader = React.forwardRef<HTMLTableSectionElement, TableHeaderProps>
(function TableHeader({className, ...props}, ref) {
  return (
    <thead
      ref={ref}
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
})
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<HTMLTableSectionElement, TableBodyProps>
(function TableBody({className, ...props}, ref) {
  return (
    <tbody
      ref={ref}
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
})
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<HTMLTableSectionElement, TableFooterProps>
(function TableFooter({className, ...props}, ref) {
  return (
    <tfoot
      ref={ref}
      className={cn("bg-card text-foreground", className)}
      {...props}
    />
  )
})
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  function TableRow({className, ...props}, ref) {
    return (
      <tr
        ref={ref}
        className={cn("border-b border-border/60 transition-colors hover:bg-card/60", className)}
        {...props}
      />
    )
  },
)
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<HTMLTableHeaderCellElement, TableHeadProps>(
  function TableHead({className, ...props}, ref) {
    return (
      <th
        ref={ref}
        className={cn("h-12 px-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground", className)}
        {...props}
      />
    )
  },
)
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  function TableCell({className, ...props}, ref) {
    return (
      <td
        ref={ref}
        className={cn("p-3 align-middle text-sm", className)}
        {...props}
      />
    )
  },
)
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<HTMLTableCaptionElement, TableCaptionProps>(
  function TableCaption({className, ...props}, ref) {
    return (
      <caption
        ref={ref}
        className={cn("mt-4 text-sm text-muted-foreground", className)}
        {...props}
      />
    )
  },
)
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
