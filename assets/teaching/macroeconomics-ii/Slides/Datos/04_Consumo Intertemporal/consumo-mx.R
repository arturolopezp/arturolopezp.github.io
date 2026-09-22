# ==============================================================================
# Centro de Investigación y Docencia Económicas (CIDE)
# Macroeconomía II
# LECO - Otoño 2026
# Suavización de consumo en México con datos agregados
# ==============================================================================

# Preámbulo --------------------------------------------------------------------
cat("\014")
rm(list = ls())
options(scipen = 999)

library(tidyverse)
library(seasonal)
library(mFilter)
library(here)
library(patchwork)

# Paths ------------------------------------------------------------------------
setwd("C:/Users/alope/Documents/GitHub/arturolopezp.github.io")
dir_macro_ii <- here("assets", "teaching", "macroeconomics-ii")
dir_sesion <- here(dir_macro_ii, "Slides", "Datos", "04_Consumo Intertemporal")

# Datos ------------------------------------------------------------------------
raw_data <- readxl::read_excel(
  here(dir_sesion, "consumo-mx.xls"),
  skip = 5
  ) %>%
  set_names(
    c(
      "Periodo", "Area", "IGAE", "IMCP_D", "IMCP_SD", "IMCP_ND"
    )
  ) %>%
  mutate(
    Periodo = as.Date(paste0(Periodo, "/01"), format = "%Y/%m/%d")
  ) %>%
  filter(
    Periodo >= as.Date("1993-01-01") & Periodo <= as.Date("2019-12-01")
    ) %>%
  select(-Area)

# Procesamiento de datos -------------------------------------------------------
data <- raw_data

# Desestacionalización ---------------------------------------------------------
series <- c("IMCP_D", "IMCP_SD", "IMCP_ND")

for (serie in series) {
  
  serie_ts <- ts(data[[serie]], start = c(1993, 1), frequency = 12)
  
  serie_x13 <- seas(serie_ts)
  
  data[[paste0(serie, "_SA")]] <- as.numeric(final(serie_x13))
  
  rm(serie_ts, serie_x13)
  
}

# Brechas ----------------------------------------------------------------------
series <- c("IGAE", "IMCP_D_SA", "IMCP_SD_SA", "IMCP_ND_SA")

for (serie in series) {
  
  serie_ts <- ts(data[[serie]], start = c(1993, 1), frequency = 12)
  
  serie_ts <- log(serie_ts)
  
  serie_hp <- hpfilter(serie_ts, freq = 129600)
  
  data[[paste0(serie, "_trend")]] <- as.numeric(serie_hp$trend)
  
  data[[paste0(serie, "_gap")]]   <- as.numeric(serie_hp$cycle)
  
  rm(serie_ts, serie_hp)
}

# Gráficas ---------------------------------------------------------------------
grafica_brechas <- function(serie_1, serie_2, label_1, label_2) {
  
  data %>% 
    ggplot(aes(x = Periodo)) +
    geom_hline(
      yintercept = 0,
      linetype = "dashed",
      color = "black",
      linewidth = 0.4
    ) +
    geom_line(aes(y = .data[[serie_1]], color = label_1),
                  linewidth = 0.7) +
    geom_line(aes(y = .data[[serie_2]], color = label_2),
                  linewidth = 0.7) +
    scale_x_date(
      date_breaks = "2 years",
      date_labels = "%Y",
      expand = c(0, 0)
    ) +
    scale_color_manual(
      values = setNames(
        c("blue", "red"),
        c(label_1, label_2)
      )
    ) +
    labs(
      x = NULL,
      y = "Porcentaje",
      color = NULL
    ) +
    # ggthemes::theme_stata(scheme = "s1color") +
    theme_minimal() +
    theme(
      # Grid
      panel.grid = element_blank(),
      # Ejes
      axis.line = element_line(color = "black"),
      axis.text = element_text(color = "black"),
      axis.title = element_text(color = "black"),
      axis.ticks = element_line(color = "black"),
      axis.ticks.length = unit(0.2, "cm"),
      # Leyenda
      legend.position = c(0.35, 0.2),
      legend.background = element_blank(),
      legend.key = element_blank(),
      legend.text = element_text(size = 10)
    )
}

# Bienes duraderos
plot_D <- grafica_brechas(
  serie_1 = "IGAE_gap",
  serie_2 = "IMCP_D_SA_gap",
  label_1 = "IGAE",
  label_2 = "IMCP Bienes Duraderos"
)
plot_D

# Bienes no duraderos
plot_ND <- grafica_brechas(
  serie_1 = "IGAE_gap",
  serie_2 = "IMCP_ND_SA_gap",
  label_1 = "IGAE",
  label_2 = "IMCP Bienes No Duraderos"
)
plot_ND

# Grid
plot_final <- (plot_D / plot_ND) +
  plot_annotation(
    title = "Consumo Privado y Actividad Económica en México",
    subtitle = "Desviación porcentual respecto a tendencia, 1993M1-2019M12",
    caption = paste0(
      "Notas: Series desestacionalizadas. Tendencia calculada con filtro HP, lambda = 129,600.\n",
      "Fuente: Elaboración propia con datos del Banco de Información Económica, INEGI."
    ),
    theme = theme(
      plot.title = element_text(
        size = 16,
        face = "bold",
        hjust = 0.5
      ),
      plot.subtitle = element_text(
        size = 12,
        face = "italic",
        hjust = 0.5
      ),
      plot.caption = element_text(
        size = 8,
        hjust = 0
      )
    )
  )

plot_final

# Exportar png
ggsave(
  filename = here(dir_sesion, "consumo-mx.png"),
  plot = plot_final,
  width = 9,
  height = 5.75,
  dpi = 300
)


# Matriz de covarianza (brechas en puntos porcentuales) ------------------------
round(
  cov(
    100 * data[, c("IGAE_gap", "IMCP_D_SA_gap", "IMCP_ND_SA_gap")]
  ),
  3
)
# Matriz de correlación --------------------------------------------------------
round(
  cor(
    data[, c("IGAE_gap", "IMCP_D_SA_gap", "IMCP_ND_SA_gap")]
  ),
  3
)