library(ggplot2)

# Parámetros y variables exógenas
psi <- 1
z <- 10
G <- 6

# Funciones de oferta y demanda laboral
Ns <- function(w) {
  1/(1+psi) + (psi*G)/((1+psi)*w) - (psi*z^2)/(4*(1+psi)*w^2)
}

Nd <- function(w) {
  z^2/(4*w^2)
}

# Pendiente de la oferta laboral
Ns_slope <- function(w) {
  -(psi*G)/((1+psi)*w^2) + (psi*z^2)/(2*(1+psi)*w^3)
}

# Salario real y empleo de equilibrio
w_star <- (-psi*G + sqrt(psi^2*G^2 + (1+2*psi)*z^2)) / 2
N_star <- Nd(w_star)

cat("w* =", w_star)
cat("N* =", N_star)
cat("Pendiente de Ns en w* =", Ns_slope(w_star))

# Umbrales de pendiente y curvatura
w1 <- z^2 / (2*G)
w2 <- 3*z^2 / (4*G)
cat("w1 (umbral pendiente) =", w1)
cat("w2 (umbral curvatura) =", w2)

# Datos para el gráfico
w <- seq(0.1, w2 * 1.1, length.out = 2000)
df <- data.frame(
  w = rep(w, 2),
  N = c(Ns(w), Nd(w)),
  curva = rep(c("N^s(w)", "N^d(w)"), each = length(w))
)

eq_point <- data.frame(w = w_star, N = N_star)

# Gráfico
ggplot(df, aes(x = N, y = w, color = curva)) +
  geom_path(linewidth = 1) +
  geom_point(data = eq_point, aes(x = N, y = w), color = "darkgreen",
             size = 3, inherit.aes = FALSE) +
  geom_hline(yintercept = w1, linetype = "dashed", color = "gray40", alpha = 0.8) +
  geom_hline(yintercept = w2, linetype = "dashed", color = "gray10", alpha = 0.7) +
  scale_color_manual(values = c("N^s(w)" = "blue", "N^d(w)" = "red")) +
  coord_cartesian(xlim = c(0, 1.2)) +
  labs(
    title = sprintf("Mercado laboral (psi=%s, z=%s, G=%s)", psi, z, G),
    x = "Empleo N",
    y = "Salario real w",
    color = NULL
  ) +
  theme_minimal() +
  theme(legend.position = "top",
        panel.grid = element_blank())