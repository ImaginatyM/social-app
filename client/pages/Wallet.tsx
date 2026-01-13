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
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Container,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import SettingsIcon from "@mui/icons-material/Settings";

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

type ConnectedWallet = {
  evm: {
    address?: string
    network?: string
    syncMethod?: string
    explorerUrl?: string
    lastSync?: string
  }
  lightning: {
    address?: string
    lastSync?: string
  }
  solana: {
    address?: string
    explorerUrl?: string
    lastSync?: string
  }
};

type Connector = {
  id: string
  label: string
  description: string
  connected: boolean
  lastSync?: string
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

const connectedWallet: ConnectedWallet = {
  evm: {
    address: "0xA45F8A1bC74d14F6C883204bAB4c5323121D8c2",
    network: "Base",
    syncMethod: "MetaMask",
    explorerUrl: "https://basescan.org/address/0xA45F8A1bC74d14F6C883204bAB4c5323121D8c2",
    lastSync: "Aujourd'hui · 09:32",
  },
  lightning: {
    address: "alice@getalby.com",
    lastSync: "Aujourd'hui · 08:47",
  },
  solana: {
    address: "7h2KM2sSg1oLk93p2fh6CN9W7BQ6jA5tX9P4LAV3",
    explorerUrl: "https://solscan.io/account/7h2KM2sSg1oLk93p2fh6CN9W7BQ6jA5tX9P4LAV3",
    lastSync: "Hier · 18:23",
  },
};

const connectors: Connector[] = [
  {
    id: "metamask",
    label: "MetaMask",
    description: "Connexion EVM (Base/Ethereum)",
    connected: Boolean(connectedWallet.evm.address),
    lastSync: connectedWallet.evm.lastSync,
  },
  {
    id: "phantom",
    label: "Phantom",
    description: "Connexion Solana",
    connected: Boolean(connectedWallet.solana.address),
    lastSync: connectedWallet.solana.lastSync,
  },
];

const formatChange = (value: number) => {
  if (!Number.isFinite(value)) return "0.00%";
  const pct = (value * 100).toFixed(2);
  return `${value >= 0 ? "+" : ""}${pct}%`;
};

const formatCurrency = (value: number) =>
  `$${value.toLocaleString(undefined, {maximumFractionDigits: 2})}`;

type InfoFieldProps = {
  label: string
  value?: string
  helper?: string
  placeholder?: string
  actions?: React.ReactNode
};

function InfoField({label, value, helper, placeholder = "Non renseigné", actions}: InfoFieldProps) {
  return (
    <Stack spacing={1.25}>
      <Typography
        variant="caption"
        sx={{
          textTransform: "uppercase",
          letterSpacing: 2,
          fontWeight: 600,
          color: "text.secondary",
        }}>
        {label}
      </Typography>
      <Paper
        variant="outlined"
        sx={{
          px: 2,
          py: 1.75,
          borderRadius: 2,
          display: "flex",
          flexDirection: {xs: "column", sm: "row"},
          gap: 2,
          justifyContent: "space-between",
          alignItems: {xs: "flex-start", sm: "center"},
        }}>
        <Box>
          <Typography
            fontWeight={600}
            sx={{wordBreak: "break-all"}}
            color={value ? "text.primary" : "text.disabled"}>
            {value || placeholder}
          </Typography>
          {helper ? (
            <Typography variant="caption" color="text.secondary">
              {helper}
            </Typography>
          ) : null}
        </Box>
        {actions ? (
          <Box sx={{display: "flex", gap: 1, flexWrap: "wrap"}}>{actions}</Box>
        ) : null}
      </Paper>
    </Stack>
  );
}

type ConnectorStatusProps = Connector;

function ConnectorStatusCard({label, description, connected, lastSync}: ConnectorStatusProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        px: 2,
        py: 1.75,
        borderRadius: 2,
        display: "flex",
        flexDirection: {xs: "column", sm: "row"},
        gap: 1.5,
        justifyContent: "space-between",
        alignItems: {xs: "flex-start", sm: "center"},
      }}>
      <Box>
        <Typography fontWeight={600}>{label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {connected
            ? lastSync || "Synchronisation active"
            : "Connexion non initialisée"}
        </Typography>
      </Box>
      <Chip
        label={connected ? "Connecté" : "Non connecté"}
        color={connected ? "success" : "default"}
        variant={connected ? "filled" : "outlined"}
        size="small"
        sx={{fontWeight: 600}}
      />
    </Paper>
  );
}

export default function WalletPage() {
  const totalValue = tokenRows.reduce((acc, row) => acc + row.value, 0);
  const weightedChange = tokenRows.reduce((acc, row) => acc + row.change24h * row.value, 0) / (totalValue || 1);
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!copiedField) return;
    const timeout = window.setTimeout(() => setCopiedField(null), 1600);
    return () => window.clearTimeout(timeout);
  }, [copiedField]);

  const handleCopy = React.useCallback((value: string | undefined, key: string) => {
    if (!value) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard
        .writeText(value)
        .then(() => setCopiedField(key))
        .catch(() => setCopiedField(key));
    } else {
      setCopiedField(key);
    }
  }, []);

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
            backdropFilter: "blur(12px)",
            bgcolor: "rgba(17, 24, 39, 0.82)",
          }}
        >
          <Container
            maxWidth="lg"
            sx={{py: 3, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2}}
          >
            <Typography variant="h5" fontWeight={600} letterSpacing={0.5}>
              Wallet
            </Typography>
            <Stack direction="row" spacing={1.5}>
              <Button
                variant="outlined"
                color="primary"
                size="small"
                startIcon={<RefreshIcon fontSize="small" />}>
                Actualiser
              </Button>
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={<SettingsIcon fontSize="small" />}
                component="a"
                href="/wallet-settings">
                Gérer les wallets
              </Button>
            </Stack>
          </Container>
        </Box>

        <Container maxWidth="lg" sx={{py: 6}}>
          <Box
            sx={{
              maxWidth: 900,
              mx: "auto",
              px: {xs: 1.5, md: 2},
              display: "flex",
              flexDirection: "column",
              gap: {xs: 3, md: 4},
            }}>
            <Card
              elevation={10}
              sx={{
                bgcolor: "card",
                color: "card-foreground",
                borderRadius: "24px",
              }}>
              <CardContent
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  textAlign: "center",
                  py: {xs: 4, md: 5},
                }}>
                <Typography
                  variant="subtitle2"
                  sx={{letterSpacing: 6, textTransform: "uppercase", color: "muted-foreground"}}>
                  Solde total
                </Typography>
                <Typography variant="h2" fontWeight={700}>
                  {formatCurrency(totalValue)}
                </Typography>
                <Chip
                  label={`Variation 24h · ${formatChange(weightedChange)}`}
                  color={weightedChange >= 0 ? "success" : "error"}
                  variant="outlined"
                  sx={{fontWeight: 600}}
                />
                <Typography variant="body2" color="text.secondary">
                  Synchronisé automatiquement avec vos connecteurs actifs.
                </Typography>
              </CardContent>
            </Card>

            <Card elevation={6} sx={{bgcolor: "card"}}>
              <CardHeader
                title={<Typography variant="h6">Wallet connecté</Typography>}
                subheader={
                  <Typography variant="body2" color="muted-foreground">
                    Mise en forme identique aux paramètres pour retrouver vos informations essentielles
                  </Typography>
                }
              />
              <CardContent sx={{pt: 0}}>
                <Stack spacing={{xs: 3, md: 3.5}}>
                  {connectors.map(connector => (
                    <ConnectorStatusCard key={connector.id} {...connector} />
                  ))}

                  <InfoField
                    label="Adresse EVM (Base/Ethereum)"
                    value={connectedWallet.evm.address}
                    helper={connectedWallet.evm.syncMethod ? `Synchronisé via ${connectedWallet.evm.syncMethod}` : undefined}
                    actions={
                      connectedWallet.evm.address ? (
                        <>
                          <Tooltip title={copiedField === "evm-address" ? "Copié !" : "Copier"}>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<ContentCopyIcon fontSize="small" />}
                              onClick={() => handleCopy(connectedWallet.evm.address, "evm-address")}>
                              Copier
                            </Button>
                          </Tooltip>
                          {connectedWallet.evm.explorerUrl ? (
                            <Button
                              variant="outlined"
                              size="small"
                              component="a"
                              href={connectedWallet.evm.explorerUrl}
                              target="_blank"
                              rel="noreferrer">
                              Explorer
                            </Button>
                          ) : null}
                        </>
                      ) : null
                    }
                  />

                  <InfoField
                    label="Réseau sélectionné"
                    value={connectedWallet.evm.network}
                    helper="Réseau actuellement actif pour MetaMask"
                    actions={
                      connectedWallet.evm.network ? (
                        <Chip
                          label={connectedWallet.evm.network}
                          color="primary"
                          size="small"
                          variant="outlined"
                          sx={{fontWeight: 600}}
                        />
                      ) : null
                    }
                  />

                  <InfoField
                    label="Lightning Address (optionnel)"
                    value={connectedWallet.lightning.address}
                    helper={
                      connectedWallet.lightning.address
                        ? `Dernière synchronisation ${connectedWallet.lightning.lastSync ?? ''}`.trim()
                        : "Ajoutez une adresse Lightning pour la rendre visible ici"
                    }
                    actions={
                      connectedWallet.lightning.address ? (
                        <Tooltip title={copiedField === "lightning-address" ? "Copié !" : "Copier"}>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<ContentCopyIcon fontSize="small" />}
                            onClick={() => handleCopy(connectedWallet.lightning.address, "lightning-address")}>
                            Copier
                          </Button>
                        </Tooltip>
                      ) : null
                    }
                  />

                  <ConnectorStatusCard
                    id="phantom"
                    label="Phantom"
                    description="Connexion Solana"
                    connected={Boolean(connectedWallet.solana.address)}
                    lastSync={connectedWallet.solana.lastSync}
                  />

                  <InfoField
                    label="Adresse Solana"
                    value={connectedWallet.solana.address}
                    helper={
                      connectedWallet.solana.address
                        ? `Dernière synchronisation ${connectedWallet.solana.lastSync ?? ''}`.trim()
                        : "Connectez Phantom pour afficher votre adresse Solana"
                    }
                    actions={
                      connectedWallet.solana.address ? (
                        <>
                          <Tooltip title={copiedField === "solana-address" ? "Copié !" : "Copier"}>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<ContentCopyIcon fontSize="small" />}
                              onClick={() => handleCopy(connectedWallet.solana.address, "solana-address")}>
                              Copier
                            </Button>
                          </Tooltip>
                          {connectedWallet.solana.explorerUrl ? (
                            <Button
                              variant="outlined"
                              size="small"
                              component="a"
                              href={connectedWallet.solana.explorerUrl}
                              target="_blank"
                              rel="noreferrer">
                              Explorer
                            </Button>
                          ) : null}
                        </>
                      ) : null
                    }
                  />

                  <Divider sx={{my: 1}} />

                  <Stack spacing={1.5}>
                    <Typography variant="body2" color="text.secondary">
                      Besoin d'ajuster vos connexions ? Retrouver les mêmes sections dans les paramètres wallets pour ajouter, supprimer ou resynchroniser vos adresses.
                    </Typography>
                    <Stack direction={{xs: "column", sm: "row"}} spacing={1.5}>
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={<SettingsIcon />}
                        component="a"
                        href="/wallet-settings">
                        Ouvrir les paramètres wallet
                      </Button>
                      <Button variant="outlined" color="primary">
                        Exporter les données
                      </Button>
                    </Stack>
                  </Stack>

                  <Typography variant="caption" color="text.secondary">
                    Seules des informations publiques sont stockées. Aucune clé privée n'est conservée côté application.
                  </Typography>
                </Stack>
              </CardContent>
            </Card>

            <Card elevation={6} sx={{bgcolor: "card"}}>
              <CardHeader
                title={<Typography variant="h6">Portefeuille</Typography>}
                subheader={<Typography variant="body2" color="muted-foreground">Vos avoirs actuels</Typography>}
              />
              <CardContent sx={{pt: 0}}>
                <TableContainer component={Paper} elevation={0} sx={{bgcolor: "transparent"}}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Token</TableCell>
                        <TableCell>Réseau</TableCell>
                        <TableCell align="right">Quantité</TableCell>
                        <TableCell align="right">Prix</TableCell>
                        <TableCell align="right">Valeur</TableCell>
                        <TableCell align="right">24h</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tokenRows.map(row => (
                        <TableRow key={row.id} hover>
                          <TableCell>
                            <Stack direction="row" spacing={2} alignItems="center">
                              <Box
                                sx={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: "50%",
                                  bgcolor: "primary.main",
                                  color: "primary.contrastText",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 14,
                                  fontWeight: 600,
                                }}>
                                {row.symbol.slice(0, 2)}
                              </Box>
                              <Box>
                                <Typography fontWeight={600}>{row.name}</Typography>
                                <Typography variant="caption" color="muted-foreground">
                                  {row.symbol}
                                </Typography>
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell>{row.chain}</TableCell>
                          <TableCell align="right">{row.amount.toLocaleString(undefined, {maximumFractionDigits: 6})}</TableCell>
                          <TableCell align="right">{formatCurrency(row.price)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.value)}</TableCell>
                          <TableCell
                            align="right"
                            sx={{color: row.change24h >= 0 ? "success.main" : "error.main"}}>
                            {formatChange(row.change24h)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>

            <Card elevation={6} sx={{bgcolor: "card"}}>
              <CardHeader
                title={<Typography variant="h6">Marché en direct</Typography>}
                subheader={<Typography variant="body2" color="muted-foreground">Paires principales</Typography>}
              />
              <CardContent sx={{pt: 0}}>
                <Stack spacing={2.5}>
                  {marketTickers.map(ticker => (
                    <Paper
                      key={ticker.pair}
                      variant="outlined"
                      sx={{
                        px: 2,
                        py: 1.75,
                        borderRadius: 2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 2,
                      }}>
                      <Box>
                        <Typography fontWeight={600}>{ticker.pair}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Capitalisation {ticker.cap} · Volume 24h {ticker.volume}
                        </Typography>
                      </Box>
                      <Box textAlign="right">
                        <Typography fontWeight={600}>{formatCurrency(ticker.price)}</Typography>
                        <Typography
                          variant="caption"
                          sx={{color: ticker.change >= 0 ? "success.main" : "error.main"}}>
                          {formatChange(ticker.change)}
                        </Typography>
                      </Box>
                    </Paper>
                  ))}
                </Stack>
              </CardContent>
            </Card>

            <Card elevation={6} sx={{bgcolor: "card"}}>
              <CardHeader
                title={<Typography variant="h6">Actions rapides</Typography>}
                subheader={<Typography variant="body2" color="muted-foreground">Gérez votre portefeuille en un clic</Typography>}
              />
              <CardContent>
                <Stack
                  direction={{xs: "column", md: "row"}}
                  spacing={2}
                  justifyContent="space-between"
                  alignItems={{xs: "stretch", md: "center"}}
                >
                  <Button variant="contained" color="primary" fullWidth sx={{maxWidth: {md: 240}}}>
                    Acheter de la crypto
                  </Button>
                  <Button variant="contained" color="secondary" fullWidth sx={{maxWidth: {md: 240}}}>
                    Vendre des actifs
                  </Button>
                  <Button variant="outlined" color="primary" fullWidth sx={{maxWidth: {md: 240}}}>
                    Envoyer vers une adresse
                  </Button>
                </Stack>
                <Divider sx={{my: 3}} />
                <Typography variant="body2" color="muted-foreground">
                  Astuce : configurez des alertes de prix pour être notifié au bon moment.
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Container>
      </SidebarInset>
    </SidebarProvider>
  );
}
