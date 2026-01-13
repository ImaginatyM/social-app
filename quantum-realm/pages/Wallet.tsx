"use client";
import React from "react";

import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Stack,
  Avatar,
  Button,
  Divider,
  TextField,
  InputAdornment,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import SendIcon from "@mui/icons-material/Send";

type Row = {
  id: string
  chain: string
  symbol: string
  name: string
  amount: number
  price: number
  value: number
  change24h: number
};

const tokenRows: Row[] = [
  {id: "btc", chain: "Bitcoin", symbol: "BTC", name: "Bitcoin", amount: 0.1123, price: 48032.32, value: 5387.63, change24h: 0.042},
  {id: "eth", chain: "Ethereum", symbol: "ETH", name: "Ethereum", amount: 3.21, price: 3520.02, value: 11307.26, change24h: -0.018},
  {id: "sol", chain: "Solana", symbol: "SOL", name: "Solana", amount: 45.5, price: 148.11, value: 6733.01, change24h: 0.12},
  {id: "usdc", chain: "Base", symbol: "USDC", name: "USD Coin", amount: 2500, price: 1, value: 2500, change24h: 0},
];

const marketTickers = [
  {pair: "BTC / USD", price: 48032.32, change: 0.042, cap: "$3.56M", volume: "$65.20M"},
  {pair: "ETH / USD", price: 3520.02, change: -0.018, cap: "$1.12M", volume: "$21.04M"},
  {pair: "SOL / USD", price: 148.11, change: 0.12, cap: "$0.86M", volume: "$6.32M"},
];

const compactCards = [
  {label: "Solde total", value: "$102,904", change: 0.036},
  {label: "Achats ce mois", value: "$2,480", change: -0.014},
  {label: "Revenus staking", value: "$4,120", change: 0.031},
  {label: "Frais gas", value: "$92", change: -0.22},
];

const SparkLine = ({id, color, path}: {id: string; color: string; path: string}) => (
  <Box sx={{height: 46}}>
    <svg viewBox="0 0 200 60" width="100%" height="100%">
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <path d={path} fill="none" stroke={`url(#spark-${id})`} strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  </Box>
);

const PriceBadge = ({value}: {value: number}) => (
  <Typography
    variant="body2"
    sx={{color: value >= 0 ? "success.main" : "destructive", fontWeight: 600}}
  >
    {(value >= 0 ? "+" : "") + (value * 100).toFixed(2)}%
  </Typography>
);

export default function WalletPage() {
  const totalValue = tokenRows.reduce((acc, row) => acc + row.value, 0);
  const weightedChange = tokenRows.reduce((acc, row) => acc + row.change24h * row.value, 0) / (totalValue || 1);

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader />
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive tooltip="Wallet">
                Wallet
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Transactions">Transactions</SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Paramètres">Paramètres</SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="bg-background text-foreground">
        <Box
          component="header"
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            borderBottom: "1px solid",
            borderColor: "border",
            bgcolor: "rgba(9,14,24,0.92)",
            backdropFilter: "blur(12px)",
          }}
        >
          <Container
            maxWidth="lg"
            sx={{py: 3, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2}}
          >
            <Typography variant="h5" fontWeight={600} letterSpacing={0.5}>
              Dashboard
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center" sx={{flex: 1, justifyContent: "flex-end"}}>
              <TextField
                size="small"
                placeholder="Search..."
                variant="outlined"
                sx={{
                  minWidth: 200,
                  maxWidth: 320,
                  bgcolor: "rgba(255,255,255,0.05)",
                  borderRadius: "14px",
                  '& .MuiOutlinedInput-root': {borderRadius: "14px"},
                  input: {color: "foreground"},
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{fontSize: 20, color: "muted-foreground"}} />
                    </InputAdornment>
                  ),
                }}
              />
              <IconButton sx={{color: "foreground"}}>
                <NotificationsNoneIcon />
              </IconButton>
              <Avatar sx={{bgcolor: "primary.main"}}>CH</Avatar>
            </Stack>
          </Container>
        </Box>

        <Container maxWidth="lg" sx={{py: 6}}>
          <Stack spacing={5}>
            <Grid container spacing={3}>
              {kpis.map(card => (
                <Grid key={card.id} item xs={12} sm={6} lg={3}>
                  <Card
                    elevation={12}
                    sx={{
                      borderRadius: "22px",
                      bgcolor: "rgba(17,24,39,0.9)",
                      border: "1px solid rgba(148,163,184,0.08)",
                    }}
                  >
                    <CardContent sx={{pt: 4, pb: 3}}
                    >
                      <Stack spacing={2.5}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar sx={{width: 40, height: 40, bgcolor: card.color}}>
                            {card.symbol}
                          </Avatar>
                          <Box>
                            <Typography fontWeight={600}>{card.label}</Typography>
                            <Typography variant="caption" color="muted-foreground">
                              {card.symbol}
                            </Typography>
                          </Box>
                        </Stack>
                        <Typography variant="h5" fontWeight={700}>{card.value}</Typography>
                        <PriceBadge value={card.change} />
                        <SparkLine id={card.id} color={card.color} path={card.spark} />
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            <Grid container spacing={4}>
              <Grid item xs={12} md={4}>
                <Card
                  elevation={14}
                  sx={{
                    borderRadius: "24px",
                    background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                    color: "white",
                    height: "100%",
                  }}
                >
                  <CardContent sx={{p: 4, height: "100%"}}>
                    <Stack spacing={4} height="100%" justifyContent="space-between">
                      <Stack spacing={1}>
                        <Typography
                          variant="subtitle2"
                          sx={{letterSpacing: 6, textTransform: "uppercase", opacity: 0.8}}
                        >
                          Credit Card
                        </Typography>
                        <Typography variant="h5" fontWeight={600}>
                          3475 7381 3759 4512
                        </Typography>
                        <Typography variant="body2" sx={{opacity: 0.7}}>
                          Darrell Steward
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <CreditCardIcon sx={{opacity: 0.7}} />
                        <Typography variant="h6">VIZA</Typography>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={8}>
                <Card elevation={12} sx={{borderRadius: "24px", bgcolor: "rgba(13,18,30,0.95)"}}>
                  <CardHeader
                    title={<Typography variant="h6">Performance globale</Typography>}
                    subheader={<Typography variant="body2" color="muted-foreground">Aperçu du marché</Typography>}
                  />
                  <CardContent>
                    <Box sx={{height: 220}}>
                      <svg viewBox="0 0 640 220" width="100%" height="100%">
                        <defs>
                          <linearGradient id="chart-area" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgba(59,130,246,0.35)" />
                            <stop offset="100%" stopColor="rgba(59,130,246,0)" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M0 160 L40 150 L80 155 L120 130 L160 140 L200 105 L240 125 L280 115 L320 135 L360 120 L400 135 L440 150 L480 140 L520 160 L560 150 L600 165 L640 150"
                          fill="url(#chart-area)"
                        />
                        <path
                          d="M0 160 L40 150 L80 155 L120 130 L160 140 L200 105 L240 125 L280 115 L320 135 L360 120 L400 135 L440 150 L480 140 L520 160 L560 150 L600 165 L640 150"
                          fill="none"
                          stroke="rgba(59,130,246,0.9)"
                          strokeWidth="3"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Grid container spacing={4}>
              <Grid item xs={12} md={5}>
                <Card elevation={8} sx={{bgcolor: "rgba(17,24,39,0.92)", borderRadius: "20px"}}>
                  <CardHeader
                    title={<Typography variant="h6">My Portfolio</Typography>}
                    subheader={<Typography variant="body2" color="muted-foreground">Avoirs détaillés</Typography>}
                  />
                  <CardContent>
                    <Stack spacing={3}>
                      {tokenRows.map(token => (
                        <Stack key={`portfolio-${token.id}`} direction="row" justifyContent="space-between" alignItems="center">
                          <Stack direction="row" spacing={2} alignItems="center">
                            <Avatar sx={{width: 36, height: 36, bgcolor: "rgba(148,163,184,0.2)", color: "white"}}>
                              {token.symbol.slice(0, 2)}
                            </Avatar>
                            <Box>
                              <Typography fontWeight={600}>{token.name}</Typography>
                              <Typography variant="caption" color="muted-foreground">
                                ${token.value.toLocaleString(undefined, {maximumFractionDigits: 2})}
                              </Typography>
                            </Box>
                          </Stack>
                          <Stack textAlign="right">
                            <PriceBadge value={token.change24h} />
                            <Typography variant="caption" color="muted-foreground">
                              {token.amount.toLocaleString(undefined, {maximumFractionDigits: 4})} {token.symbol}
                            </Typography>
                          </Stack>
                        </Stack>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={7}>
                <Card elevation={8} sx={{bgcolor: "rgba(17,24,39,0.92)", borderRadius: "20px"}}>
                  <CardHeader
                    title={<Typography variant="h6">Live Market</Typography>}
                    subheader={<Typography variant="body2" color="muted-foreground">Données en temps réel</Typography>}
                    action={<Button variant="outlined" size="small">Voir plus</Button>}
                  />
                  <CardContent>
                    <TableContainer component={Paper} elevation={0} sx={{bgcolor: "transparent"}}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Paire</TableCell>
                            <TableCell>Variation</TableCell>
                            <TableCell>Market Cap</TableCell>
                            <TableCell>Volume 24h</TableCell>
                            <TableCell align="right">Prix</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {marketTickers.map(ticker => (
                            <TableRow key={ticker.pair} hover>
                              <TableCell>{ticker.pair}</TableCell>
                              <TableCell>
                                <PriceBadge value={ticker.change} />
                              </TableCell>
                              <TableCell>{ticker.cap}</TableCell>
                              <TableCell>{ticker.volume}</TableCell>
                              <TableCell align="right">{ticker.price.toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Card elevation={8} sx={{bgcolor: "rgba(17,24,39,0.92)", borderRadius: "20px"}}>
              <CardHeader
                title={<Typography variant="h6">Actions rapides</Typography>}
                subheader={<Typography variant="body2" color="muted-foreground">Gérez votre portefeuille en un clic</Typography>}
              />
              <CardContent>
                <Stack direction={{xs: "column", md: "row"}} spacing={2} alignItems="stretch">
                  <Button
                    variant="contained"
                    startIcon={<TrendingUpIcon />}
                    color="primary"
                    sx={{flex: 1, minHeight: 48}}
                  >
                    Acheter de la crypto
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<SwapHorizIcon />}
                    color="secondary"
                    sx={{flex: 1, minHeight: 48}}
                  >
                    Vendre / Échanger
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<SendIcon />}
                    color="primary"
                    sx={{flex: 1, minHeight: 48}}
                  >
                    Envoyer vers une adresse
                  </Button>
                </Stack>
                <Divider sx={{my: 3}} />
                <Typography variant="body2" color="muted-foreground">
                  Astuce : paramétrez des alertes personnalisées pour anticiper les mouvements de marché.
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        </Container>
      </SidebarInset>
    </SidebarProvider>
  );
}
